'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('ko-KR').format(n);
  const clean = s => String(s ?? '').replace(/\u200b/g, '');
  const esc = s => clean(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = s => Number(String(s ?? '').replace(/,/g, '')) || 0;
  const label = s => s === '-' ? '해당 없음' : s;
  const colors = ['#007a60','#6c9bc2','#e2ae54','#af83ad','#8fb66b','#b9c1bd'];
  const charts = [];
  const required = {
    '양식설명':['항목','내용'],
    '작품목록':['작품','대표 회차','댓글 수(postCount, 답글 포함)','별점(참여 지표 보조)','링크'],
    '댓글분석':['작품','댓글 원문','공감 수','비공감 수','베스트 여부','반응 군집','핵심감정','감상 이후 욕구'],
    '작품별요약':['작품','핵심 반응 패턴','주요 욕망 1','주요 욕망 2','주요 욕망 3','대표 댓글(공감 수)','작품 정체성/불변 요소','반례·주의 신호'],
    '문화신호_교차검증':['작품','검증 판정','주요 문화신호','근거(댓글 내 정황)','외부 출처 1','외부 출처 2','외부 출처 3','반례/반대 근거','비고'],
    '종합인사이트':['단계','핵심 발견(10작품 댓글 근거)','근거 작품·댓글(공감 수)','「이세계 도전 매운맛 5단계 여고생」 기획 시사점']
  };
  let data = {};
  function link(url, text) {
    try { const u = new URL(url); if (!['http:','https:'].includes(u.protocol)) return esc(text); }
    catch { return esc(text); }
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
  }
  function sources(value) {
    const text = clean(value); const parts = text.split(/(https?:\/\/[^\s<>"“”]+)/g);
    return parts.map(p => /^https?:\/\//.test(p) ? link(p,p) : esc(p)).join('');
  }
  function table(headers, rows, caption) {
    return `<table><caption>${esc(caption)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>i===0?`<th scope="row">${v}</th>`:`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function chart(id, type, labels, datasets, options = {}) {
    const c = new Chart($(id), {type,data:{labels,datasets}, options:{responsive:true,maintainAspectRatio:false,locale:'ko-KR',animation:false,plugins:{legend:{display:datasets.length>1,position:'bottom',labels:{usePointStyle:true,padding:18}},tooltip:{padding:12}},...options}});
    charts.push(c); return c;
  }
  function bars(id, entries, name, color = colors[0]) {
    return chart(id,'bar',entries.map(x=>x[0]),[{label:name,data:entries.map(x=>x[1]),backgroundColor:color,borderRadius:4,maxBarThickness:24}],{indexAxis:'y',scales:{x:{beginAtZero:true,title:{display:true,text:'공감 수 (건)'}},y:{grid:{display:false}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${name}: ${fmt(c.raw)}건`}}}});
  }
  function verdict(s) {return s.startsWith('부분')?'부분 확인':s.startsWith('확인')?'확인':'미확보';}
  function render() {
    charts.splice(0).forEach(c=>c.destroy());
    const works=data['작품목록'], comments=data['댓글분석'];
    const names=works.map(w=>w['작품']);
    const sum = rows=>rows.reduce((a,r)=>a+num(r['공감 수']),0);
    const perWork = name=>comments.filter(r=>r['작품']===name);
    $('metrics').innerHTML=[['분석 작품',names.length,'작품'],['분석 댓글',comments.length,'개'],['베스트 댓글',comments.filter(r=>r['베스트 여부']==='베스트').length,'개'],['총 공감 수',sum(comments),'건']].map(([s,n,u])=>`<div class="metric"><span>${s}</span><strong>${fmt(n)}<small>${u}</small></strong></div>`).join('');
    bars('likes',names.map(n=>[n,sum(perWork(n))]).sort((a,b)=>b[1]-a[1]),'표본 댓글 공감 합계');
    const emotions=[...new Set(comments.map(r=>r['핵심감정']))].sort((a,b)=>a==='-'?1:b==='-'?-1:0);
    chart('emotions','bar',names,emotions.map((e,i)=>({label:label(e),data:names.map(n=>{const rows=perWork(n);return rows.length?100*rows.filter(r=>r['핵심감정']===e).length/rows.length:0;}),backgroundColor:e==='-'?'#b9c1bd':colors[i%colors.length],maxBarThickness:28})),{indexAxis:'y',scales:{x:{stacked:true,max:100,ticks:{callback:v=>v+'%'},title:{display:true,text:'분석 댓글 내 비율 (%)'}},y:{stacked:true,grid:{display:false}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.raw.toFixed(1)}%`}}}});
    const desires=[...new Set(comments.map(r=>r['감상 이후 욕구']))].sort((a,b)=>a==='-'?1:b==='-'?-1:0);
    const counts=names.map(n=>desires.map(d=>perWork(n).filter(r=>r['감상 이후 욕구']===d).length));
    const max=Math.max(1,...counts.flat());
    $('heatmap').innerHTML=table(['작품',...desires.map(label)],names.map((n,i)=>[esc(n),...counts[i].map((v,j)=>`<span style="display:block;border-radius:5px;padding:10px;background:${desires[j]==='-'?`rgba(120,130,125,${.06+.5*v/max})`:`rgba(0,122,96,${.05+.75*v/max})`};color:${v/max>.6&&desires[j]!=='-'?'white':'#172e2b'}">${v}</span>`)]),'감상 이후 욕구별 댓글 수 · 해당 없음 포함');
    $('work-filter').innerHTML='<option value="">전체 작품</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');
    let clusterChart;
    const renderClusters=()=>{
      if(clusterChart){clusterChart.destroy();charts.splice(charts.indexOf(clusterChart),1);}
      const grouped=new Map();comments.filter(r=>!$('work-filter').value||r['작품']===$('work-filter').value).forEach(r=>grouped.set(r['반응 군집'],(grouped.get(r['반응 군집'])||0)+num(r['공감 수'])));
      clusterChart=bars('cluster',[...grouped].sort((a,b)=>b[1]-a[1]).slice(0,15),'군집 공감 합계');
    }; $('work-filter').onchange=renderClusters;renderClusters();
    chart('reactions','scatter',[],['베스트','일반 댓글'].map((v,i)=>({label:v,data:comments.filter(r=>(r['베스트 여부']==='베스트')===(i===0)).map(r=>({x:num(r['공감 수']),y:num(r['비공감 수']),comment:clean(r['댓글 원문']),work:r['작품']})),backgroundColor:i===0?'#007a60b3':'#b17d43aa',pointRadius:4,pointHoverRadius:7})),{scales:{x:{beginAtZero:true,title:{display:true,text:'공감 수 (건)'}},y:{beginAtZero:true,title:{display:true,text:'비공감 수 (건)'}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{title:items=>items[0].raw.work,label:c=>[`공감 ${fmt(c.raw.x)} · 비공감 ${fmt(c.raw.y)}`,...(c.raw.comment.slice(0,100)+(c.raw.comment.length>100?'…':'')).match(/.{1,25}/gu)||[]]}}}});
    $('comment-table').innerHTML=table(['작품','댓글 원문','공감','비공감','베스트 여부'],comments.map(r=>[esc(r['작품']),esc(r['댓글 원문']),fmt(num(r['공감 수'])),fmt(num(r['비공감 수'])),r['베스트 여부']==='베스트'?'베스트':'일반 댓글']),'분석 댓글 전체 · 작성자 정보는 수집하지 않음');
    chart('episode-chart','bar',names,[{label:'전체 댓글 수',data:works.map(r=>num(r['댓글 수(postCount, 답글 포함)'])),backgroundColor:'#78ad95',yAxisID:'y',order:2,borderRadius:4},{type:'line',label:'별점',data:works.map(r=>num(r['별점(참여 지표 보조)'])),borderColor:'#b7792b',backgroundColor:'#b7792b',yAxisID:'rating',showLine:false,pointRadius:5,order:1}],{scales:{y:{type:'logarithmic',title:{display:true,text:'댓글 수 (로그 눈금)'}},rating:{position:'right',min:0,max:10,grid:{drawOnChartArea:false},title:{display:true,text:'별점 (10점 만점)'}},x:{grid:{display:false}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.datasetIndex===1?`별점: ${c.raw.toFixed(2)}`:`전체 댓글 수: ${fmt(c.raw)}건`}}}});
    $('episode-table').innerHTML=table(['작품','대표 회차','전체 댓글 수','별점','조회 범위'],works.map(r=>[esc(r['작품']),link(r['링크'],r['대표 회차']),fmt(num(r['댓글 수(postCount, 답글 포함)'])),num(r['별점(참여 지표 보조)']).toFixed(2),esc(r['조회 범위(무료 회차)'])]),'대표 회차 상세 · 회차명은 원문 링크');
    const signals=data['문화신호_교차검증'];const groups=['확인','부분 확인','미확보'];
    chart('verdicts','doughnut',groups,[{label:'판정 수',data:groups.map(g=>signals.filter(r=>verdict(r['검증 판정'])===g).length),backgroundColor:['#64a378','#e2ba5e','#b9c1bd'],borderWidth:3}],{cutout:'72%',plugins:{legend:{display:true,position:'bottom'},tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw}건`}}}});
    $('signal-table').innerHTML=table(['작품','문화신호','댓글 내 근거','외부 출처','반례·반대 근거','검증 판정'],signals.map(r=>{const v=verdict(r['검증 판정']);return [esc(r['작품']),esc(r['주요 문화신호']),esc(r['근거(댓글 내 정황)']),[1,2,3].map(i=>r[`외부 출처 ${i}`]?`<p>${sources(r[`외부 출처 ${i}`])}</p>`:'').join(''),sources(r['반례/반대 근거']),`<span class="badge ${v==='확인'?'confirmed':v==='부분 확인'?'partial':'missing'}">${v}</span><p>${esc(r['검증 판정'])}</p>${r['비고']?`<p>${esc(r['비고'])}</p>`:''}`];}),'문화신호 교차검증 전체 · 외부 출처는 새 창으로 열림');
    const summaries=new Map(data['작품별요약'].map(r=>[r['작품'],r]));
    $('work-cards').innerHTML=works.map(w=>{const r=summaries.get(w['작품']);if(!r)return '';return `<article class="panel work-card"><div class="genre">${esc(w['장르(태그)'])}</div><h3>${esc(w['작품'])}</h3><p>${link(w['링크'],w['대표 회차'])}</p><p>${esc(r['핵심 반응 패턴'])}</p><blockquote>${esc(r['대표 댓글(공감 수)'])}</blockquote><h4>세 가지 욕망</h4><ol class="desires">${[1,2,3].map(i=>`<li>${esc(r[`주요 욕망 ${i}`])}</li>`).join('')}</ol><h4>작품 정체성 / 불변 요소</h4><p>${esc(r['작품 정체성/불변 요소'])}</p><div class="caution"><span class="badge partial">반례·주의 신호</span><p>${esc(r['반례·주의 신호'])}</p></div></article>`;}).join('');
    const insights=data['종합인사이트'];const implication='「이세계 도전 매운맛 5단계 여고생」 기획 시사점';
    $('timeline').innerHTML=insights.filter(r=>/^\d\./.test(r['단계'])).map((r,i)=>`<article class="panel step" data-step="${i+1}"><h3>${esc(r['단계'])}</h3><div class="step-grid"><div><p>${esc(r['핵심 발견(10작품 댓글 근거)'])}</p><p class="evidence">근거 · ${esc(r['근거 작품·댓글(공감 수)'])}</p></div><div class="implication"><h4>기획에 적용한다면</h4><p>${esc(r[implication])}</p></div></div></article>`).join('');
    $('insight-summary').innerHTML=insights.filter(r=>!/^\d\./.test(r['단계'])).map(r=>`<h3>${esc(r['단계'])}</h3><p>${esc(r['핵심 발견(10작품 댓글 근거)'])}</p><p><strong>${esc(r[implication])}</strong></p>`).join('');
    $('method-details').innerHTML=data['양식설명'].map(r=>`<dt>${esc(r['항목'])}</dt><dd>${esc(r['내용'])}</dd>`).join('');
  }
  async function load() {
    $('reload').disabled=true;$('error').hidden=true;$('loaded').textContent='데이터를 불러오는 중입니다…';
    try {
      if(!window.Papa||!window.Chart)throw new Error('차트·CSV 라이브러리를 불러오지 못했습니다. 인터넷 연결과 CDN 접근을 확인해 주세요.');
      const stamp=Date.now();
      const entries=await Promise.all(Object.keys(required).map(async name=>{
        try {
          if(!window.DATA_SOURCES?.[name])throw new Error('데이터 주소가 없습니다.');
          const url=new URL(window.DATA_SOURCES[name],document.baseURI);url.searchParams.set('t',stamp);
          const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`응답 상태 ${response.status}`);
          const parsed=Papa.parse(await response.text(),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});
          if(parsed.errors.length)throw new Error('CSV 형식이 올바르지 않습니다.');
          const missing=required[name].filter(k=>!parsed.meta.fields?.includes(k));
          if(missing.length)throw new Error(`필수 열이 없습니다: ${missing.join(', ')}`);
          if(!parsed.data.length)throw new Error('데이터 행이 없습니다.');
          return [name,parsed.data];
        }catch(e){throw new Error(`${name}: ${e.message}`);}
      }));
      const next=Object.fromEntries(entries);const keys=new Set(next['작품목록'].map(r=>r['작품']));
      for(const tab of ['댓글분석','작품별요약','문화신호_교차검증'])if(next[tab].some(r=>r['작품'].split(/\s*\/\s*/).some(name=>!keys.has(name))))throw new Error(`${tab}: 작품목록과 연결되지 않는 작품이 있습니다.`);
      data=next;$('dashboard').hidden=false;render();
      $('loaded').textContent='데이터 불러온 시각: '+new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Seoul'}).format(new Date())+' (한국 시간)';
    } catch(e) {
      $('dashboard').hidden=true;$('error').hidden=false;$('error').textContent=`데이터를 표시할 수 없습니다.\n${e.message}\n데이터 주소·CSV 공개 설정을 확인한 뒤 ‘새로 불러오기’를 눌러 주세요. 구글 시트는 ‘웹에 게시’한 CSV 주소가 필요합니다.`;$('loaded').textContent='데이터 불러오기 실패';
    } finally {$('reload').disabled=false;}
  }
  $('reload').addEventListener('click',load);load();
})();
