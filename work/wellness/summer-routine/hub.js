"use strict";
(() => {
  const tabs=[...document.querySelectorAll("[data-mode]")];
  const routine=document.getElementById("routineView");
  const sequence=document.getElementById("sequenceView");
  const frame=document.getElementById("yogaStudioFrame");
  function activate(mode,updateHash=true){
    const isSequence=mode==="sequence";
    routine.classList.toggle("active",!isSequence);
    sequence.classList.toggle("active",isSequence);
    tabs.forEach(t=>{const on=t.dataset.mode===mode;t.classList.toggle("active",on);t.setAttribute("aria-selected",String(on));});
    if(isSequence&&!frame.src)frame.src=frame.dataset.src;
    if(updateHash)history.replaceState(null,"",isSequence?"#sequence":"#routine");
  }
  tabs.forEach(t=>t.addEventListener("click",()=>activate(t.dataset.mode)));
  window.addEventListener("hashchange",()=>activate(location.hash==="#sequence"?"sequence":"routine",false));
  window.addEventListener("message",event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==="summer-yoga-height")frame.style.height=`${Math.max(1000,Math.min(5200,Number(event.data.height)||1400))}px`;
  });
  activate(location.hash==="#sequence"?"sequence":"routine",false);
})();
