(() => {
  'use strict';

  const AIRPORTS = [

  { code:'ICN', city:'Seoul', name:'Incheon International', country:'South Korea', lat:37.4602, lon:126.4407, region:'Asia' },
  { code:'GMP', city:'Seoul', name:'Gimpo International', country:'South Korea', lat:37.5583, lon:126.7906, region:'Asia' },
  { code:'PUS', city:'Busan', name:'Gimhae International', country:'South Korea', lat:35.1795, lon:128.9382, region:'Asia' },
  { code:'CJU', city:'Jeju', name:'Jeju International', country:'South Korea', lat:33.5113, lon:126.4930, region:'Asia' },
  { code:'NRT', city:'Tokyo', name:'Narita International', country:'Japan', lat:35.7720, lon:140.3929, region:'Asia' },
  { code:'HND', city:'Tokyo', name:'Haneda', country:'Japan', lat:35.5494, lon:139.7798, region:'Asia' },
  { code:'KIX', city:'Osaka', name:'Kansai International', country:'Japan', lat:34.4347, lon:135.2440, region:'Asia' },
  { code:'FUK', city:'Fukuoka', name:'Fukuoka', country:'Japan', lat:33.5859, lon:130.4507, region:'Asia' },
  { code:'CTS', city:'Sapporo', name:'New Chitose', country:'Japan', lat:42.7752, lon:141.6923, region:'Asia' },
  { code:'PEK', city:'Beijing', name:'Beijing Capital', country:'China', lat:40.0799, lon:116.6031, region:'Asia' },
  { code:'PKX', city:'Beijing', name:'Beijing Daxing', country:'China', lat:39.5098, lon:116.4105, region:'Asia' },
  { code:'PVG', city:'Shanghai', name:'Shanghai Pudong', country:'China', lat:31.1443, lon:121.8083, region:'Asia' },
  { code:'SHA', city:'Shanghai', name:'Shanghai Hongqiao', country:'China', lat:31.1979, lon:121.3363, region:'Asia' },
  { code:'HKG', city:'Hong Kong', name:'Hong Kong International', country:'Hong Kong', lat:22.3080, lon:113.9185, region:'Asia' },
  { code:'TPE', city:'Taipei', name:'Taoyuan International', country:'Taiwan', lat:25.0797, lon:121.2342, region:'Asia' },
  { code:'SIN', city:'Singapore', name:'Changi', country:'Singapore', lat:1.3644, lon:103.9915, region:'Asia' },
  { code:'BKK', city:'Bangkok', name:'Suvarnabhumi', country:'Thailand', lat:13.6900, lon:100.7501, region:'Asia' },
  { code:'KUL', city:'Kuala Lumpur', name:'Kuala Lumpur International', country:'Malaysia', lat:2.7456, lon:101.7072, region:'Asia' },
  { code:'MNL', city:'Manila', name:'Ninoy Aquino International', country:'Philippines', lat:14.5086, lon:121.0198, region:'Asia' },
  { code:'SGN', city:'Ho Chi Minh City', name:'Tan Son Nhat', country:'Vietnam', lat:10.8188, lon:106.6519, region:'Asia' },
  { code:'HAN', city:'Hanoi', name:'Noi Bai International', country:'Vietnam', lat:21.2187, lon:105.8042, region:'Asia' },
  { code:'DEL', city:'Delhi', name:'Indira Gandhi International', country:'India', lat:28.5562, lon:77.1000, region:'Asia' },
  { code:'BOM', city:'Mumbai', name:'Chhatrapati Shivaji Maharaj International', country:'India', lat:19.0896, lon:72.8656, region:'Asia' },
  { code:'CGK', city:'Jakarta', name:'Soekarno–Hatta International', country:'Indonesia', lat:-6.1256, lon:106.6559, region:'Asia' },
  { code:'DXB', city:'Dubai', name:'Dubai International', country:'United Arab Emirates', lat:25.2532, lon:55.3657, region:'Middle East' },
  { code:'DOH', city:'Doha', name:'Hamad International', country:'Qatar', lat:25.2731, lon:51.6081, region:'Middle East' },
  { code:'AUH', city:'Abu Dhabi', name:'Zayed International', country:'United Arab Emirates', lat:24.4330, lon:54.6511, region:'Middle East' },
  { code:'IST', city:'Istanbul', name:'Istanbul Airport', country:'Türkiye', lat:41.2753, lon:28.7519, region:'Europe' },
  { code:'LHR', city:'London', name:'Heathrow', country:'United Kingdom', lat:51.4700, lon:-0.4543, region:'Europe' },
  { code:'LGW', city:'London', name:'Gatwick', country:'United Kingdom', lat:51.1537, lon:-0.1821, region:'Europe' },
  { code:'CDG', city:'Paris', name:'Charles de Gaulle', country:'France', lat:49.0097, lon:2.5479, region:'Europe' },
  { code:'AMS', city:'Amsterdam', name:'Schiphol', country:'Netherlands', lat:52.3105, lon:4.7683, region:'Europe' },
  { code:'FRA', city:'Frankfurt', name:'Frankfurt Airport', country:'Germany', lat:50.0379, lon:8.5622, region:'Europe' },
  { code:'MUC', city:'Munich', name:'Munich Airport', country:'Germany', lat:48.3538, lon:11.7861, region:'Europe' },
  { code:'MAD', city:'Madrid', name:'Adolfo Suárez Madrid–Barajas', country:'Spain', lat:40.4983, lon:-3.5676, region:'Europe' },
  { code:'BCN', city:'Barcelona', name:'Josep Tarradellas Barcelona–El Prat', country:'Spain', lat:41.2974, lon:2.0833, region:'Europe' },
  { code:'FCO', city:'Rome', name:'Leonardo da Vinci–Fiumicino', country:'Italy', lat:41.8003, lon:12.2389, region:'Europe' },
  { code:'ZRH', city:'Zurich', name:'Zurich Airport', country:'Switzerland', lat:47.4581, lon:8.5555, region:'Europe' },
  { code:'VIE', city:'Vienna', name:'Vienna International', country:'Austria', lat:48.1103, lon:16.5697, region:'Europe' },
  { code:'CPH', city:'Copenhagen', name:'Copenhagen Airport', country:'Denmark', lat:55.6180, lon:12.6508, region:'Europe' },
  { code:'ARN', city:'Stockholm', name:'Stockholm Arlanda', country:'Sweden', lat:59.6519, lon:17.9186, region:'Europe' },
  { code:'OSL', city:'Oslo', name:'Oslo Gardermoen', country:'Norway', lat:60.1939, lon:11.1004, region:'Europe' },
  { code:'HEL', city:'Helsinki', name:'Helsinki Airport', country:'Finland', lat:60.3172, lon:24.9633, region:'Europe' },
  { code:'ATH', city:'Athens', name:'Athens International', country:'Greece', lat:37.9364, lon:23.9445, region:'Europe' },
  { code:'LIS', city:'Lisbon', name:'Humberto Delgado', country:'Portugal', lat:38.7742, lon:-9.1342, region:'Europe' },
  { code:'JFK', city:'New York', name:'John F. Kennedy International', country:'United States', lat:40.6413, lon:-73.7781, region:'North America' },
  { code:'LGA', city:'New York', name:'LaGuardia', country:'United States', lat:40.7769, lon:-73.8740, region:'North America' },
  { code:'EWR', city:'Newark', name:'Newark Liberty International', country:'United States', lat:40.6895, lon:-74.1745, region:'North America' },
  { code:'LAX', city:'Los Angeles', name:'Los Angeles International', country:'United States', lat:33.9416, lon:-118.4085, region:'North America' },
  { code:'SFO', city:'San Francisco', name:'San Francisco International', country:'United States', lat:37.6213, lon:-122.3790, region:'North America' },
  { code:'SEA', city:'Seattle', name:'Seattle–Tacoma International', country:'United States', lat:47.4502, lon:-122.3088, region:'North America' },
  { code:'ORD', city:'Chicago', name:"O'Hare International", country:'United States', lat:41.9742, lon:-87.9073, region:'North America' },
  { code:'DFW', city:'Dallas', name:'Dallas Fort Worth International', country:'United States', lat:32.8998, lon:-97.0403, region:'North America' },
  { code:'IAH', city:'Houston', name:'George Bush Intercontinental', country:'United States', lat:29.9902, lon:-95.3368, region:'North America' },
  { code:'MIA', city:'Miami', name:'Miami International', country:'United States', lat:25.7959, lon:-80.2870, region:'North America' },
  { code:'BOS', city:'Boston', name:'Logan International', country:'United States', lat:42.3656, lon:-71.0096, region:'North America' },
  { code:'ATL', city:'Atlanta', name:'Hartsfield–Jackson Atlanta International', country:'United States', lat:33.6407, lon:-84.4277, region:'North America' },
  { code:'DEN', city:'Denver', name:'Denver International', country:'United States', lat:39.8561, lon:-104.6737, region:'North America' },
  { code:'YVR', city:'Vancouver', name:'Vancouver International', country:'Canada', lat:49.1951, lon:-123.1779, region:'North America' },
  { code:'YYZ', city:'Toronto', name:'Toronto Pearson International', country:'Canada', lat:43.6777, lon:-79.6248, region:'North America' },
  { code:'MEX', city:'Mexico City', name:'Mexico City International', country:'Mexico', lat:19.4361, lon:-99.0719, region:'North America' },
  { code:'SYD', city:'Sydney', name:'Sydney Kingsford Smith', country:'Australia', lat:-33.9399, lon:151.1753, region:'Oceania' },
  { code:'MEL', city:'Melbourne', name:'Melbourne Airport', country:'Australia', lat:-37.6690, lon:144.8410, region:'Oceania' },
  { code:'BNE', city:'Brisbane', name:'Brisbane Airport', country:'Australia', lat:-27.3942, lon:153.1218, region:'Oceania' },
  { code:'AKL', city:'Auckland', name:'Auckland Airport', country:'New Zealand', lat:-37.0082, lon:174.7850, region:'Oceania' },
  { code:'GRU', city:'São Paulo', name:'São Paulo/Guarulhos International', country:'Brazil', lat:-23.4356, lon:-46.4731, region:'South America' },
  { code:'GIG', city:'Rio de Janeiro', name:'Rio de Janeiro/Galeão International', country:'Brazil', lat:-22.8090, lon:-43.2506, region:'South America' },
  { code:'EZE', city:'Buenos Aires', name:'Ministro Pistarini International', country:'Argentina', lat:-34.8222, lon:-58.5358, region:'South America' },
  { code:'SCL', city:'Santiago', name:'Arturo Merino Benítez International', country:'Chile', lat:-33.3929, lon:-70.7858, region:'South America' },
  { code:'LIM', city:'Lima', name:'Jorge Chávez International', country:'Peru', lat:-12.0219, lon:-77.1143, region:'South America' },
  { code:'BOG', city:'Bogotá', name:'El Dorado International', country:'Colombia', lat:4.7016, lon:-74.1469, region:'South America' },
  { code:'JNB', city:'Johannesburg', name:'O. R. Tambo International', country:'South Africa', lat:-26.1337, lon:28.2420, region:'Africa' },
  { code:'CPT', city:'Cape Town', name:'Cape Town International', country:'South Africa', lat:-33.9700, lon:18.6021, region:'Africa' },
  { code:'CAI', city:'Cairo', name:'Cairo International', country:'Egypt', lat:30.1219, lon:31.4056, region:'Africa' },
  { code:'ADD', city:'Addis Ababa', name:'Bole International', country:'Ethiopia', lat:8.9779, lon:38.7993, region:'Africa' },
  { code:'NBO', city:'Nairobi', name:'Jomo Kenyatta International', country:'Kenya', lat:-1.3192, lon:36.9278, region:'Africa' }
  ];
  const DURATION_PRESETS = [15, 25, 50, 90, 120, 180];
  const INTENTS = [
    { name:'Study', label:'STUDY ON A FLIGHT', sub:'Read · review · solve' },
    { name:'Work', label:'WORK ON A FLIGHT', sub:'Build · analyze · ship' },
    { name:'Create', label:'CREATE ON A FLIGHT', sub:'Write · design · explore' }
  ];
  const COUNTRIES = [...new Set(AIRPORTS.map(a=>a.country))].sort((a,b)=>a.localeCompare(b,'en'));
  const COUNTRY_ALIASES = {
    '대한민국':'South Korea','한국':'South Korea','일본':'Japan','중국':'China','홍콩':'Hong Kong','대만':'Taiwan','싱가포르':'Singapore',
    '태국':'Thailand','말레이시아':'Malaysia','필리핀':'Philippines','베트남':'Vietnam','인도':'India','인도네시아':'Indonesia',
    '아랍에미리트':'United Arab Emirates','UAE':'United Arab Emirates','카타르':'Qatar','튀르키예':'Türkiye','터키':'Türkiye',
    '영국':'United Kingdom','프랑스':'France','네덜란드':'Netherlands','독일':'Germany','스페인':'Spain','이탈리아':'Italy','스위스':'Switzerland',
    '오스트리아':'Austria','덴마크':'Denmark','스웨덴':'Sweden','노르웨이':'Norway','핀란드':'Finland','그리스':'Greece','포르투갈':'Portugal',
    '미국':'United States','캐나다':'Canada','멕시코':'Mexico','호주':'Australia','뉴질랜드':'New Zealand','브라질':'Brazil','아르헨티나':'Argentina',
    '칠레':'Chile','페루':'Peru','콜롬비아':'Colombia','남아프리카공화국':'South Africa','남아공':'South Africa','이집트':'Egypt','에티오피아':'Ethiopia','케냐':'Kenya'
  };
  const KEYS = {
    home:'bigong.home.v1', session:'bigong.session.v1', history:'bigong.history.v1', theme:'bigong.theme.v1'
  };

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  let tickTimer = null;
  let toastTimer = null;
  let audio = null;
  let routeMapSeq = 0;
  let routeMaps = [];
  let landMask = null;
  fetch('./landmask.bin').then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>{ landMask=new Uint8Array(b); }).catch(()=>{});

  const safeRead = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const airportByCode = (code) => AIRPORTS.find(a => a.code === code);
  const toRad = v => v * Math.PI / 180;
  const haversineKm = (a,b) => {
    const R=6371, dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon), lat1=toRad(a.lat), lat2=toRad(b.lat);
    const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  };
  const nearestAirport = (lat,lon) => [...AIRPORTS].sort((a,b)=>haversineKm({lat,lon},a)-haversineKm({lat,lon},b))[0];
  const recommendDestinations = (home, minutes, count=8) => {
    const target=Math.max(250, minutes*75);
    return AIRPORTS.filter(a=>a.code!==home.code).map(airport=>({airport,distance:haversineKm(home,airport)}))
      .sort((a,b)=>Math.abs(a.distance-target)-Math.abs(b.distance-target)).slice(0,count);
  };
  const validDestination = (home, destination, minutes) => {
    if(destination && destination.code !== home.code && airportByCode(destination.code)) return airportByCode(destination.code);
    return recommendDestinations(home, minutes, 1)[0]?.airport || AIRPORTS.find(a=>a.code!==home.code);
  };
  const airportsInCountry = (country, home) => AIRPORTS.filter(a=>a.country===country && a.code!==home.code);
  const intentLabel = name => INTENTS.find(x=>x.name===name)?.label || String(name||'').toUpperCase();
  const resolveCountryName = value => {
    const raw=String(value||'').trim();
    if(!raw) return null;
    const direct=COUNTRIES.find(c=>c.toLowerCase()===raw.toLowerCase());
    if(direct) return direct;
    const aliasKey=Object.keys(COUNTRY_ALIASES).find(k=>k.toLowerCase()===raw.toLowerCase());
    return aliasKey ? COUNTRY_ALIASES[aliasKey] : null;
  };
  const countryAliasFor = country => Object.entries(COUNTRY_ALIASES).find(([,v])=>v===country)?.[0] || '';

  const normalizeLon = lon => ((lon + 540) % 360) - 180;
  const greatCirclePoints = (a,b,steps=120) => {
    const lat1=toRad(a.lat), lon1=toRad(a.lon), lat2=toRad(b.lat), lon2=toRad(b.lon);
    const v1=[Math.cos(lat1)*Math.cos(lon1),Math.cos(lat1)*Math.sin(lon1),Math.sin(lat1)];
    const v2=[Math.cos(lat2)*Math.cos(lon2),Math.cos(lat2)*Math.sin(lon2),Math.sin(lat2)];
    const dot=Math.max(-1,Math.min(1,v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2]));
    const omega=Math.acos(dot), sinOmega=Math.sin(omega);
    const out=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      let x,y,z;
      if(sinOmega<1e-8){ x=v1[0]+t*(v2[0]-v1[0]); y=v1[1]+t*(v2[1]-v1[1]); z=v1[2]+t*(v2[2]-v1[2]); }
      else { const s1=Math.sin((1-t)*omega)/sinOmega, s2=Math.sin(t*omega)/sinOmega; x=s1*v1[0]+s2*v2[0]; y=s1*v1[1]+s2*v2[1]; z=s1*v1[2]+s2*v2[2]; }
      const lat=Math.atan2(z,Math.hypot(x,y))*180/Math.PI;
      let lon=Math.atan2(y,x)*180/Math.PI;
      if(out.length){ const prev=out[out.length-1].lon; while(lon-prev>180)lon-=360; while(lon-prev<-180)lon+=360; }
      out.push({lat,lon});
    }
    return out;
  };
  const routePosition = (a,b,progress) => {
    const points=greatCirclePoints(a,b,160), p=Math.max(0,Math.min(1,progress))*(points.length-1), i=Math.min(points.length-2,Math.floor(p)), f=p-i;
    return {lat:points[i].lat+(points[i+1].lat-points[i].lat)*f, lon:points[i].lon+(points[i+1].lon-points[i].lon)*f};
  };
  const bearingBetween = (a,b) => {
    const p1=toRad(a.lat), p2=toRad(b.lat), dl=toRad(normalizeLon(b.lon-a.lon));
    const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  };
  const isLandAt = (lat,lon) => {
    if(!landMask || landMask.length!==64800) return null;
    const row=Math.max(0,Math.min(179,Math.floor(lat+90))), col=Math.max(0,Math.min(359,Math.floor(normalizeLon(lon)+180)));
    return landMask[row*360+col]===1;
  };
  const localSolarHour = lon => ((new Date().getUTCHours()+new Date().getUTCMinutes()/60+normalizeLon(lon)/15)%24+24)%24;
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtClock = seconds => {
    const s=Math.max(0,Math.floor(seconds)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  const fmtTime = t => new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(t);
  const fmtDist = km => km>=1000?`${(km/1000).toFixed(1)}k km`:`${Math.round(km)} km`;
  const formatDate = () => new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date());

  let state = {
    screen:'setup',
    home:safeRead(KEYS.home,null) || airportByCode('ICN'),
    homeConfirmed:Boolean(safeRead(KEYS.home,null)),
    destination:airportByCode('HND'),
    destinationMode:'time',
    destinationCountry:'Japan',
    duration:50,
    customDuration:'',
    intent:'Study',
    outcome:'',
    theme:safeRead(KEYS.theme,'light'),
    audioEnabled:false,
    volume:.22,
    flightView:'map',
    session:safeRead(KEYS.session,null),
    history:safeRead(KEYS.history,[]),
    lastFlight:null,
    picker:null,
    locating:false
  };
  state.destination=validDestination(state.home,state.destination,50);
  state.destinationCountry=state.destination?.country || 'Japan';
  if (state.session?.status === 'active') state.screen='flight';

  function effectiveDuration(){
    const v=state.customDuration?Number(state.customDuration):state.duration;
    return Math.max(5,Math.min(180,Number.isFinite(v)?v:state.duration));
  }
  function stats(){
    const sessions=state.history.length;
    const totalMinutes=state.history.reduce((n,x)=>n+Number(x.durationMinutes||0),0);
    const days=[...new Set(state.history.map(x=>new Date(x.completedAt).toDateString()))].map(x=>new Date(x).getTime()).sort((a,b)=>b-a);
    let streak=0; const d=new Date(); d.setHours(0,0,0,0); let cursor=d.getTime(), day=86400000;
    for(const t of days){
      if(t===cursor || (streak===0 && t===cursor-day)){ if(streak===0 && t===cursor-day) cursor-=day; streak++; cursor-=day; }
      else if(t<cursor) break;
    }
    return {sessions,totalMinutes,streak};
  }
  function showToast(message){
    let t=$('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
    t.textContent=message; t.hidden=false;
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.hidden=true;},2600);
  }
  function applyTheme(){ document.documentElement.dataset.theme=state.theme; save(KEYS.theme,state.theme); }
  function toggleTheme(){ state.theme=state.theme==='dark'?'light':'dark'; applyTheme(); render(); }
  function planeIcon(){ return '✈'; }

  function loadLeaflet(){
    if(window.L)return Promise.resolve(window.L);
    if(window.__bigongLeafletPromise)return window.__bigongLeafletPromise;
    window.__bigongLeafletPromise=new Promise((resolve,reject)=>{
      if(!document.getElementById('leafletCss')){ const link=document.createElement('link'); link.id='leafletCss'; link.rel='stylesheet'; link.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link); }
      const script=document.createElement('script'); script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'; script.async=true;
      script.onload=()=>{ initRouteMaps(); resolve(window.L); };
      script.onerror=()=>reject(new Error('Leaflet unavailable'));
      document.head.appendChild(script);
    });
    return window.__bigongLeafletPromise;
  }
  function destroyRouteMaps(){
    routeMaps.forEach(item=>{ try{ item.map.remove(); }catch{} });
    routeMaps=[];
  }
  function routeMap(home,destination,progress=.42,compact=false){
    const id=`bigongMap${++routeMapSeq}`;
    return `<div class="route-map ${compact?'route-map--compact':''}" data-route-map id="${id}" data-home="${home.code}" data-destination="${destination.code}" data-progress="${progress}">
      <div class="map-canvas" aria-label="Map route from ${esc(home.city)} to ${esc(destination.city)}"></div>
      <div class="map-fallback" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <div class="route-city route-city--from"><b>${home.code}</b><span>${esc(home.city)}</span></div>
      <div class="route-city route-city--to"><b>${destination.code}</b><span>${esc(destination.city)}</span></div>
    </div>`;
  }
  function initRouteMaps(){
    if(!window.L) return;
    document.querySelectorAll('[data-route-map]').forEach(host=>{
      const home=airportByCode(host.dataset.home), destination=airportByCode(host.dataset.destination), canvas=host.querySelector('.map-canvas');
      if(!home||!destination||!canvas)return;
      const compact=host.classList.contains('route-map--compact'), progress=Number(host.dataset.progress||0);
      const points=greatCirclePoints(home,destination,140), latlngs=points.map(p=>[p.lat,p.lon]);
      const map=L.map(canvas,{zoomControl:!compact,attributionControl:true,dragging:!compact,scrollWheelZoom:false,doubleClickZoom:!compact,boxZoom:!compact,keyboard:!compact,touchZoom:!compact,worldCopyJump:true,preferCanvas:true});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
      const route=L.polyline(latlngs,{color:'#879bb5',weight:3,opacity:.55,dashArray:'7 8'}).addTo(map);
      const upto=Math.max(1,Math.floor(progress*(points.length-1))+1);
      const progressLine=L.polyline(latlngs.slice(0,upto+1),{color:'#ff8fc7',weight:4,opacity:.96}).addTo(map);
      L.circleMarker([home.lat,home.lon],{radius:5,weight:2,color:'#ffffff',fillColor:'#8bd7ff',fillOpacity:1}).addTo(map);
      L.circleMarker([destination.lat,destination.lon],{radius:5,weight:2,color:'#ffffff',fillColor:'#c7b7ff',fillOpacity:1}).addTo(map);
      const pos=routePosition(home,destination,progress), ahead=routePosition(home,destination,Math.min(1,progress+.01)), heading=bearingBetween(pos,ahead);
      const icon=L.divIcon({className:'leaflet-plane-wrap',html:`<span class="leaflet-plane" style="--heading:${heading}deg">✈</span>`,iconSize:[34,34],iconAnchor:[17,17]});
      const marker=L.marker([pos.lat,pos.lon],{icon,interactive:false}).addTo(map);
      map.fitBounds(route.getBounds(),{padding:compact?[24,24]:[46,46],maxZoom:compact?4:5});
      host.classList.add('map-ready');
      routeMaps.push({map,host,home,destination,points,marker,progressLine});
      setTimeout(()=>map.invalidateSize(),0);
    });
  }
  function updateRouteMaps(progress){
    routeMaps.forEach(item=>{
      const pos=routePosition(item.home,item.destination,progress), ahead=routePosition(item.home,item.destination,Math.min(1,progress+.01)), heading=bearingBetween(pos,ahead);
      item.marker.setLatLng([pos.lat,pos.lon]);
      const inner=item.marker.getElement()?.querySelector('.leaflet-plane'); if(inner) inner.style.setProperty('--heading',`${heading}deg`);
      const upto=Math.max(1,Math.floor(progress*(item.points.length-1))+1);
      item.progressLine.setLatLngs(item.points.slice(0,upto+1).map(p=>[p.lat,p.lon]));
    });
  }
  function windowScene(home,destination,progress,phase){
    const pos=routePosition(home,destination,progress), land=isLandAt(pos.lat,pos.lon), hour=localSolarHour(pos.lon);
    const light=hour<5||hour>=20?'night':hour<7?'dawn':hour>=17?'dusk':'day';
    const surface=land===true?'land':land===false?'ocean':'clouds';
    const phaseKey=progress<.08?'takeoff':progress<.2?'climb':progress<.82?'cruise':progress<.96?'descent':'landing';
    const coord=`${Math.abs(pos.lat).toFixed(1)}°${pos.lat>=0?'N':'S'} · ${Math.abs(normalizeLon(pos.lon)).toFixed(1)}°${normalizeLon(pos.lon)>=0?'E':'W'}`;
    const localHour=Math.floor(hour), localMinute=Math.round((hour-localHour)*60)%60;
    return `<div class="window-view ${light} ${surface} ${phaseKey}" id="routeWindow" data-progress="${progress}">
      <div class="window-meta"><span>${phase.toUpperCase()}</span><span>${coord}</span></div>
      <div class="aircraft-window"><div class="window-frame"><div class="window-glass">
        <div class="sky-glow"></div><div class="stars-layer"></div><div class="sun-disc"></div>
        <div class="cloud-layer cloud-layer--far"></div><div class="horizon-layer"></div><div class="ground-layer"></div><div class="city-lights"></div><div class="cloud-layer cloud-layer--near"></div>
        <div class="wing"><span></span></div>
      </div></div></div>
      <div class="window-status"><span>SIMULATED · ROUTE-SYNCED</span><b>${land===true?'OVER LAND':land===false?'OVER OCEAN':'EN ROUTE'}</b><span>LOCAL ${String(localHour).padStart(2,'0')}:${String(localMinute).padStart(2,'0')}</span></div>
    </div>`;
  }

  function header(){
    return `<header class="top-nav shell">
      <a class="brand" href="./" data-action="home"><span class="brand-mark">✈</span><span>비공 <small class="brand-en">BIGONG</small></span></a>
      <nav><a href="#planner">Flight planner</a><a class="portal-back" href="../">← <span>Workspace</span></a><button class="theme-switch" type="button" data-action="theme" aria-label="Theme">${state.theme==='dark'?'☀':'☾'}</button></nav>
    </header>`;
  }

  function renderSetup(){
    const d=effectiveDuration();
    state.destination=validDestination(state.home,state.destination,d);
    if(!state.destinationCountry || !COUNTRIES.includes(state.destinationCountry)) state.destinationCountry=state.destination.country;
    const st=stats(), recs=recommendDestinations(state.home,d,4);
    const countryAirports=airportsInCountry(state.destinationCountry,state.home);
    const distance=haversineKm(state.home,state.destination);
    const countryOptions=COUNTRIES.map(country=>{
      const alias=countryAliasFor(country);
      return `<option value="${esc(country)}">${alias?esc(alias):esc(country)}</option>${alias?`<option value="${esc(alias)}">${esc(country)}</option>`:''}`;
    }).join('');
    app.innerHTML=`<div class="app-shell">${header()}
      <main>
        <section class="hero shell">
          <div class="hero-copy"><span class="eyebrow">${intentLabel(state.intent)}</span><h1>비행하듯<br><em>몰입하는 시간.</em></h1><p>출발 공항과 목적지 혹은 비행 시간을 정해서 탑승한 순간부터 착륙까지 집중하기!</p></div>
          <div class="hero-visual">${routeMap(state.home,state.destination,.42,true)}<div class="hero-card"><small>NEXT FLIGHT</small><div><b>${state.home.code}</b><span>✈</span><b>${state.destination.code}</b></div><span>${d} min · ${intentLabel(state.intent)}</span></div></div>
        </section>

        <section class="planner-section shell" id="planner">
          <div class="planner-head"><div><span class="eyebrow">FLIGHT LOG</span></div><div class="mini-stats"><span>🏆 <b>${st.sessions}</b><small>flights</small></span><span>⏱ <b>${st.totalMinutes}</b><small>minutes</small></span><span>🔥 <b>${st.streak}</b><small>day streak</small></span></div></div>
          <div class="planner-grid">
            <section class="planner-card planner-card--home"><div class="card-step"><span>01</span><div><small>HOME AIRPORT</small><h3>어디에서 출발할까요?</h3></div></div>
              ${state.homeConfirmed?`<div class="selected-airport"><div class="airport-badge">${state.home.code}</div><div><b>${esc(state.home.city)}</b><span>${esc(state.home.name)}</span></div><button class="button button--small" data-action="pick-home">Change</button></div>`:`<div class="home-actions"><button class="button button--primary" data-action="locate" ${state.locating?'disabled':''}>⌖ ${state.locating?'Finding nearest…':'가까운 공항 찾기'}</button><button class="button" data-action="pick-home">⌕ 직접 선택</button></div>`}
            </section>
            <section class="planner-card"><div class="card-step"><span>02</span><div><small>FLIGHT TIME</small><h3>얼마나 비행할까요?</h3></div></div>
              <div class="duration-grid">${DURATION_PRESETS.map(m=>`<button data-duration="${m}" class="${!state.customDuration&&state.duration===m?'selected':''}">${m}<small>min</small></button>`).join('')}</div>
              <label class="custom-duration"><span>Custom</span><input id="customDuration" type="number" min="5" max="180" value="${esc(state.customDuration)}" placeholder="5–180"><span>minutes</span></label>
            </section>
            <section class="planner-card"><div class="card-step"><span>03</span><div><small>ON BOARD</small><h3>오늘은 어떤 비행인가요?</h3></div></div>
              <div class="intent-grid">${INTENTS.map(x=>`<button data-intent="${x.name}" class="${state.intent===x.name?'selected':''}"><b>${x.label}</b><small>${x.sub}</small></button>`).join('')}</div>
              <label class="outcome-input"><span>한 줄 목표 <small>optional</small></span><input id="outcome" maxlength="120" value="${esc(state.outcome)}" placeholder="예: 논문 Methods 수정 끝내기"></label>
            </section>
            <section class="planner-card planner-card--destination"><div class="card-step"><span>04</span><div><small>DESTINATION</small><h3>목적지를 정해요.</h3></div></div>
              <div class="destination-mode-tabs">
                <button type="button" data-destination-mode="time" class="${state.destinationMode==='time'?'selected':''}">비행 시간으로 추천</button>
                <button type="button" data-destination-mode="country" class="${state.destinationMode==='country'?'selected':''}">나라 직접 선택</button>
              </div>
              <div class="selected-destination"><div><span class="airport-code-large">${state.destination.code}</span><div><b>${esc(state.destination.city)}</b><small>${esc(state.destination.country)} · ${esc(state.destination.name)}</small></div></div><button class="button button--small" data-action="pick-destination">전체 공항⌄</button></div>
              ${state.destinationMode==='time'
                ? `<div class="destination-list">${recs.map(({airport,distance})=>`<button data-destination="${airport.code}" class="${state.destination.code===airport.code?'selected':''}"><span><b>${airport.code}</b><small>${esc(airport.city)}</small></span><em>${fmtDist(distance)}</em></button>`).join('')}</div>`
                : `<div class="country-picker"><label><span>나라</span><input id="destinationCountrySearch" list="countryOptions" value="${esc(countryAliasFor(state.destinationCountry)||state.destinationCountry)}" placeholder="국가명 검색 · 일본 / Japan"><datalist id="countryOptions">${countryOptions}</datalist></label></div><div class="destination-list">${countryAirports.length?countryAirports.map(airport=>`<button data-country-airport="${airport.code}" class="${state.destination.code===airport.code?'selected':''}"><span><b>${airport.code}</b><small>${esc(airport.city)}</small></span><em>${esc(airport.name)}</em></button>`).join(''):'<div class="empty-state">이 나라에는 출발지와 다른 공항이 없습니다.</div>'}</div>`}
            </section>
          </div>
          <section class="ready-bar"><div><span class="eyebrow">READY FOR DEPARTURE</span><div class="ready-route"><b>${state.homeConfirmed?state.home.code:'---'}</b><span></span><b class="plane-text">✈</b><span></span><b>${state.destination.code}</b></div><p>${d} min · ${intentLabel(state.intent)}${state.outcome.trim()?` · ${esc(state.outcome.trim())}`:''} · ${fmtDist(distance)}</p></div><button class="button button--takeoff" data-action="boarding">✈ 탑승권 준비</button></section>
        </section>
      </main>
    </div>`;
    bindCommon(); bindSetup(); initRouteMaps();
  }

  function renderBoarding(){
    const d=effectiveDuration(), now=Date.now(), eta=now+d*60000;
    state.destination=validDestination(state.home,state.destination,d);
    const flightNumber=`OZ ${String((state.home.code.charCodeAt(0)*17+state.destination.code.charCodeAt(0)*7+d)%800+100)}`;
    const gate=`${state.destination.code[0]}${d%18+1}`;
    app.innerHTML=`<div class="boarding-screen"><header class="minimal-nav shell"><button class="brand" data-action="home"><span class="brand-mark">✈</span><span>비공 <small class="brand-en">BIGONG</small></span></button><button class="button button--ghost" data-action="edit">← 비행 수정</button></header>
      <main class="boarding-wrap shell"><div class="boarding-intro"><span class="eyebrow">BOARDING</span><h1>탑승권을 확인해 주세요.</h1><p>탑승권을 확인하면 탑승 수속이 완료됩니다.</p></div>
      <section class="boarding-pass asiana-pass">
        <div class="asiana-side"><span class="asiana-wordmark">ASIANA<br>AIRLINES</span><span class="focus-mark">BIGONG</span></div>
        <div class="pass-main">
          <div class="pass-top"><div><b>ASIANA AIRLINES</b><small>BOARDING PASS · BUSINESS</small></div><span>BIGONG</span></div>
          <div class="pass-passenger"><small>PASSENGER NAME</small><b>SEONG JOON HEE</b></div>
          <div class="pass-route"><div><small>FROM</small><strong>${state.home.code}</strong><span>${esc(state.home.city)}</span></div><div class="pass-route-line"><span></span><b class="plane-text">✈</b><span></span></div><div><small>TO</small><strong>${state.destination.code}</strong><span>${esc(state.destination.city)}</span></div></div>
          <div class="pass-data asiana-data"><div><small>FLIGHT</small><b>${flightNumber}</b></div><div><small>DATE</small><b>${new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short'}).format(now).toUpperCase()}</b></div><div><small>BOARDING</small><b>${fmtTime(now)}</b></div><div><small>ARRIVAL</small><b>${fmtTime(eta)}</b></div><div><small>GATE</small><b>${gate}</b></div><div><small>SEAT</small><b class="seat-value">7A</b></div></div>
          <div class="pass-class-row"><span>BUSINESS CLASS</span><span>${d} MIN FOCUS</span><span>${intentLabel(state.intent)}</span></div>
          ${state.outcome.trim()?`<div class="pass-intent"><small>THIS FLIGHT'S GOAL</small><p>${esc(state.outcome.trim())}</p></div>`:''}
        </div>
        <div class="pass-stub">
          <div class="stub-airline">ASIANA AIRLINES</div>
          <div class="stub-route"><b>${state.home.code}</b><span>✈</span><b>${state.destination.code}</b></div>
          <div class="stub-passenger"><small>PASSENGER</small><b>SEONG JOON HEE</b></div>
          <div class="stub-info"><span><small>FLIGHT</small><b>${flightNumber}</b></span><span><small>SEAT</small><b>7A</b></span><span><small>GATE</small><b>${gate}</b></span></div>
          <div class="barcode"></div>
        </div>
      </section>
      <button class="tear-button" data-action="takeoff">탑승권 확인 · 탑승하기</button><p class="keyboard-hint">Space pause / resume · M cabin ambience</p></main></div>`;
    bindCommon();
    document.querySelector('[data-action="edit"]').onclick=()=>{state.screen='setup';render();};
    document.querySelector('[data-action="takeoff"]').onclick=takeOff;
  }

  function getFlightSnapshot(){
    const s=state.session; if(!s)return null;
    const now=Date.now(), remaining=s.pausedAt?Math.max(0,s.endsAt-s.pausedAt):Math.max(0,s.endsAt-now), total=s.durationMinutes*60000, progress=Math.max(0,Math.min(1,1-remaining/total));
    const phase=progress<.06?'Taxi & takeoff':progress<.18?'Climb':progress<.82?'Cruise':progress<.95?'Descent':'Final approach';
    const altitude=progress<.12?Math.round(35000*(progress/.12)):progress>.88?Math.round(35000*((1-progress)/.12)):35000;
    return {s,now,remaining,total,progress,phase,altitude};
  }
  function renderFlight(){
    const snap=getFlightSnapshot(); if(!snap){state.screen='setup';return render();}
    const {s,remaining,progress,phase,altitude}=snap;
    if(!s.pausedAt && remaining<=0) return completeFlight();
    destroyRouteMaps();
    const visual=state.flightView==='window'?windowScene(s.home,s.destination,progress,phase):routeMap(s.home,s.destination,progress,false);
    app.innerHTML=`<div class="flight-screen">
      <header class="flight-toolbar"><div class="flight-identity"><span class="live-dot"></span><b>${s.home.code} → ${s.destination.code}</b><span>${intentLabel(s.intent)}</span></div><div class="flight-controls"><button data-action="theme">${state.theme==='dark'?'☀':'☾'}<span>Theme</span></button><button data-action="audio" class="${state.audioEnabled?'active':''}">${state.audioEnabled?'🔊':'🔇'}<span>Audio</span></button><button data-action="pause" class="pause-control">${s.pausedAt?'▶':'Ⅱ'}<span>${s.pausedAt?'Resume':'Pause'}</span></button></div></header>
      <main class="flight-cockpit"><section class="flight-visual-panel"><div class="visual-tabs"><button data-flight-view="map" class="${state.flightView==='map'?'active':''}">MAP</button><button data-flight-view="window" class="${state.flightView==='window'?'active':''}">WINDOW</button></div><div class="flight-visual-stage">${visual}</div></section><section class="timer-panel"><div class="phase-line"><span id="flightPhase">${phase}</span><span id="flightPercent">${Math.round(progress*100)}%</span></div><div class="timer-display" id="flightTimer">${fmtClock(remaining/1000)}</div><div id="pausedBadge">${s.pausedAt?'<div class="paused-badge">PAUSED — arrival time moves with you</div>':''}</div><div class="progress-rail"><span id="flightProgress" style="width:${progress*100}%"></span></div><div class="flight-metrics"><div><small>ARRIVAL</small><b id="metricArrival">${fmtTime(s.endsAt)}</b></div><div><small>ALTITUDE</small><b id="metricAltitude">${Math.max(0,altitude).toLocaleString()} ft</b></div><div><small>DISTANCE</small><b>${fmtDist(haversineKm(s.home,s.destination))}</b></div></div>${s.outcome?`<div class="flight-intent"><small>ON THIS FLIGHT</small><p>${esc(s.outcome)}</p></div>`:''}</section></main>
      <footer class="flight-footer"><div class="volume-wrap"><span>Cabin</span><input id="volume" type="range" min="0" max="1" step="0.01" value="${state.volume}"></div><button data-action="end-flight">End flight</button></footer>
    </div>`;
    bindCommon(); bindFlight(); if(state.flightView==='map')initRouteMaps();
  }
  function updateFlightTelemetry(){
    if(state.screen!=='flight')return;
    const snap=getFlightSnapshot(); if(!snap)return;
    const {s,remaining,progress,phase,altitude}=snap;
    if(!s.pausedAt && remaining<=0) return completeFlight();
    const timer=$('flightTimer'), phaseEl=$('flightPhase'), pct=$('flightPercent'), rail=$('flightProgress'), arrival=$('metricArrival'), alt=$('metricAltitude'), paused=$('pausedBadge');
    if(timer)timer.textContent=fmtClock(remaining/1000); if(phaseEl)phaseEl.textContent=phase; if(pct)pct.textContent=`${Math.round(progress*100)}%`; if(rail)rail.style.width=`${progress*100}%`; if(arrival)arrival.textContent=fmtTime(s.endsAt); if(alt)alt.textContent=`${Math.max(0,altitude).toLocaleString()} ft`; if(paused)paused.innerHTML=s.pausedAt?'<div class="paused-badge">PAUSED — arrival time moves with you</div>':'';
    if(state.flightView==='map')updateRouteMaps(progress);
    else { const stage=document.querySelector('.flight-visual-stage'); if(stage)stage.innerHTML=windowScene(s.home,s.destination,progress,phase); }
  }

  function renderLanded(){
    const f=state.lastFlight; if(!f){state.screen='setup';return render();}
    app.innerHTML=`<main class="landing-page shell"><div class="landing-orbit">🛬</div><span class="eyebrow">Safe arrival</span><h1>착륙했습니다.</h1><p class="lede">방해 없이 끝낸 한 블록이 비행 기록에 추가되었습니다.</p><section class="landing-ticket"><div class="landing-route"><div><small>FROM</small><strong>${f.home.code}</strong><span>${esc(f.home.city)}</span></div><b class="plane-text">✈</b><div><small>TO</small><strong>${f.destination.code}</strong><span>${esc(f.destination.city)}</span></div></div><div class="ticket-grid"><div><small>FOCUS</small><b>${f.durationMinutes} min</b></div><div><small>MODE</small><b>${intentLabel(f.intent)}</b></div><div><small>ARRIVED</small><b>${fmtTime(f.completedAt)}</b></div><div><small>FLIGHT</small><b>${f.id.slice(-6).toUpperCase()}</b></div></div>${f.outcome?`<div class="outcome-review"><small>YOUR INTENT</small><p>${esc(f.outcome)}</p></div>`:''}</section><div class="landing-actions"><button class="button button--primary" data-action="again">↻ Fly again</button><button class="button" data-action="share">⇧ Share result</button><button class="button button--ghost" data-action="new">Plan a new route</button></div></main>`;
    document.querySelector('[data-action="again"]').onclick=()=>{state.home=f.home;state.destination=f.destination;state.duration=f.durationMinutes;state.customDuration='';state.intent=f.intent;state.outcome=f.outcome;state.screen='board';render();};
    document.querySelector('[data-action="new"]').onclick=()=>{state.screen='setup';render();};
    document.querySelector('[data-action="share"]').onclick=shareResult;
  }

  function renderPicker(){
    const mode=state.picker; if(!mode) return;
    const current=mode==='home'?state.home:state.destination;
    const overlay=document.createElement('div'); overlay.id='pickerOverlay'; overlay.className='modal-backdrop';
    overlay.innerHTML=`<section class="modal airport-picker" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow">Airport directory</span><h2>${mode==='home'?'Choose your home airport':'Choose a destination'}</h2></div><button class="icon-button" data-close>×</button></div><label class="search-box">⌕<input id="airportSearch" autofocus placeholder="Search city, airport, IATA code or country"></label><div class="airport-results" id="airportResults"></div></section>`;
    document.body.appendChild(overlay);
    const draw=(q='')=>{
      const query=q.trim().toLowerCase();
      const list=AIRPORTS.filter(a=>!query||[a.code,a.city,a.name,a.country].some(v=>v.toLowerCase().includes(query)));
      $('airportResults').innerHTML=list.length?list.map(a=>`<button class="airport-row ${a.code===current.code?'airport-row--selected':''}" data-code="${a.code}"><span class="airport-code">${a.code}</span><span class="airport-meta"><b>${esc(a.city)}</b><small>${esc(a.name)} · ${esc(a.country)}</small></span><span class="airport-region">${a.code===current.code?'✓':esc(a.region)}</span></button>`).join(''):'<div class="empty-state">No airport matched that search.</div>';
      document.querySelectorAll('.airport-row').forEach(btn=>btn.onclick=()=>selectAirport(btn.dataset.code));
    };
    draw();
    $('airportSearch').oninput=e=>draw(e.target.value);
    overlay.querySelector('[data-close]').onclick=closePicker;
    overlay.onmousedown=e=>{if(e.target===overlay)closePicker();};
  }
  function closePicker(){ state.picker=null; document.getElementById('pickerOverlay')?.remove(); }
  function selectAirport(code){
    const a=airportByCode(code); if(!a)return;
    if(state.picker==='home'){
      state.home=a;state.homeConfirmed=true;save(KEYS.home,a);
      if(state.destinationMode==='country'){
        const choices=airportsInCountry(state.destinationCountry,a);
        state.destination=choices.find(x=>x.code===state.destination?.code) || choices[0] || recommendDestinations(a,effectiveDuration(),1)[0]?.airport;
      } else {
        state.destination=recommendDestinations(a,effectiveDuration(),1)[0]?.airport || validDestination(a,state.destination,effectiveDuration());
      }
      state.destination=validDestination(a,state.destination,effectiveDuration());
      state.destinationCountry=state.destination.country;
    } else {
      if(a.code===state.home.code){showToast('출발지와 다른 목적지를 선택해 주세요.');return;}
      state.destination=a;
      state.destinationCountry=a.country;
      state.destinationMode='country';
    }
    closePicker(); render();
  }

  function bindCommon(){
    document.querySelectorAll('[data-action="theme"]').forEach(x=>x.onclick=toggleTheme);
    document.querySelectorAll('[data-action="home"]').forEach(x=>x.onclick=e=>{e.preventDefault();state.screen='setup';render();});
  }
  function bindSetup(){
    document.querySelector('[data-action="pick-home"]').onclick=()=>{state.picker='home';renderPicker();};
    document.querySelector('[data-action="pick-destination"]').onclick=()=>{state.picker='destination';renderPicker();};
    document.querySelector('[data-action="locate"]')?.addEventListener('click',detectNearest);
    document.querySelector('[data-action="boarding"]').onclick=openBoarding;
    document.querySelectorAll('[data-destination-mode]').forEach(x=>x.onclick=()=>{
      state.destinationMode=x.dataset.destinationMode;
      if(state.destinationMode==='time'){
        state.destination=recommendDestinations(state.home,effectiveDuration(),1)[0]?.airport || validDestination(state.home,state.destination,effectiveDuration());
        state.destinationCountry=state.destination.country;
      } else {
        state.destinationCountry=state.destination?.country || state.destinationCountry || 'Japan';
        const choices=airportsInCountry(state.destinationCountry,state.home);
        state.destination=choices.find(a=>a.code===state.destination?.code) || choices[0] || recommendDestinations(state.home,effectiveDuration(),1)[0]?.airport;
      }
      render();
    });
    document.querySelectorAll('[data-duration]').forEach(x=>x.onclick=()=>{
      state.duration=Number(x.dataset.duration);state.customDuration='';
      if(state.destinationMode==='time') state.destination=recommendDestinations(state.home,effectiveDuration(),1)[0]?.airport || state.destination;
      state.destination=validDestination(state.home,state.destination,effectiveDuration());
      state.destinationCountry=state.destination.country;
      render();
    });
    document.querySelectorAll('[data-intent]').forEach(x=>x.onclick=()=>{state.intent=x.dataset.intent;render();});
    document.querySelectorAll('[data-destination]').forEach(x=>x.onclick=()=>{
      const a=airportByCode(x.dataset.destination); if(!a)return;
      state.destination=a;state.destinationCountry=a.country;render();
    });
    document.querySelectorAll('[data-country-airport]').forEach(x=>x.onclick=()=>{
      const a=airportByCode(x.dataset.countryAirport); if(!a)return;
      state.destination=a;state.destinationCountry=a.country;render();
    });
    const countrySearch=$('destinationCountrySearch');
    const applyCountrySearch=()=>{
      if(!countrySearch)return;
      const resolved=resolveCountryName(countrySearch.value);
      if(!resolved){showToast('검색한 국가를 찾지 못했습니다. 한글 또는 영문 국가명을 입력해 주세요.');return;}
      state.destinationCountry=resolved;
      const choices=airportsInCountry(resolved,state.home);
      state.destination=choices.find(a=>a.code===state.destination?.code) || choices[0] || recommendDestinations(state.home,effectiveDuration(),1)[0]?.airport;
      state.destination=validDestination(state.home,state.destination,effectiveDuration());
      render();
    };
    countrySearch?.addEventListener('change',applyCountrySearch);
    countrySearch?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyCountrySearch();}});
    $('customDuration').oninput=e=>{state.customDuration=e.target.value; updateReadyWithoutRender();};
    $('customDuration').onchange=e=>{
      state.customDuration=e.target.value;
      if(state.destinationMode==='time') state.destination=recommendDestinations(state.home,effectiveDuration(),1)[0]?.airport || state.destination;
      state.destination=validDestination(state.home,state.destination,effectiveDuration());
      state.destinationCountry=state.destination.country;
      render();
    };
    $('outcome').oninput=e=>{state.outcome=e.target.value;};
  }

  function updateReadyWithoutRender(){ /* input stays responsive; recommendations refresh on change */ }

  function detectNearest(){
    if(!navigator.geolocation){showToast('이 브라우저에서는 위치 정보를 사용할 수 없습니다.');return;}
    state.locating=true;render();
    navigator.geolocation.getCurrentPosition(pos=>{
      const a=nearestAirport(pos.coords.latitude,pos.coords.longitude);state.home=a;state.homeConfirmed=true;state.locating=false;save(KEYS.home,a);
      if(state.destinationMode==='time') state.destination=recommendDestinations(a,effectiveDuration(),1)[0]?.airport;
      else {
        const choices=airportsInCountry(state.destinationCountry,a);
        state.destination=choices.find(x=>x.code===state.destination?.code) || choices[0] || recommendDestinations(a,effectiveDuration(),1)[0]?.airport;
      }
      state.destination=validDestination(a,state.destination,effectiveDuration());
      state.destinationCountry=state.destination.country;
      render();showToast(`${a.code} 공항을 가장 가까운 공항으로 선택했습니다.`);
    },()=>{state.locating=false;render();showToast('위치 권한을 사용할 수 없습니다. 공항을 직접 선택해 주세요.');},{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  }
  function openBoarding(){
    state.outcome=$('outcome')?.value ?? state.outcome;
    state.customDuration=$('customDuration')?.value ?? state.customDuration;
    const d=effectiveDuration();
    if(!state.homeConfirmed){showToast('먼저 출발 공항을 확인해 주세요.');return;}
    state.destination=validDestination(state.home,state.destination,d);
    if(!state.destination){showToast('목적지 공항을 선택해 주세요.');return;}
    if(state.destination.code===state.home.code){showToast('출발지와 다른 목적지를 선택해 주세요.');return;}
    if(d<5||d>180){showToast('집중 시간은 5–180분이어야 합니다.');return;}
    state.screen='board';render();
  }
  function takeOff(){
    const startedAt=Date.now(), d=effectiveDuration();
    state.session={id:`OZ-${startedAt.toString(36)}`,home:state.home,destination:state.destination,durationMinutes:d,intent:state.intent,outcome:state.outcome.trim(),startedAt,endsAt:startedAt+d*60000,pausedAt:null,accumulatedPauseMs:0,status:'active'};
    save(KEYS.session,state.session);state.screen='flight';render();startTicker();
  }
  function startTicker(){ clearInterval(tickTimer); if(state.screen==='flight') tickTimer=setInterval(updateFlightTelemetry,500); }
  function togglePause(){
    const s=state.session;if(!s)return;const now=Date.now();
    if(s.pausedAt){const paused=now-s.pausedAt;s.endsAt+=paused;s.accumulatedPauseMs+=paused;s.pausedAt=null;}else{s.pausedAt=now;}
    save(KEYS.session,s);renderFlight();
  }
  function endFlight(){
    if(!confirm('완료 기록에 추가하지 않고 이 비행을 종료할까요?'))return;
    localStorage.removeItem(KEYS.session);state.session=null;stopAudio();state.screen='setup';clearInterval(tickTimer);render();
  }
  function completeFlight(){
    const s=state.session;if(!s)return;
    const completed={id:s.id,homeCode:s.home.code,destinationCode:s.destination.code,durationMinutes:s.durationMinutes,intent:s.intent,outcome:s.outcome,completedAt:Date.now()};
    state.history=[completed,...state.history.filter(x=>x.id!==completed.id)].slice(0,500);save(KEYS.history,state.history);localStorage.removeItem(KEYS.session);
    state.lastFlight={...completed,home:s.home,destination:s.destination};state.session=null;stopAudio();state.screen='landed';clearInterval(tickTimer);navigator.vibrate?.([180,80,180]);render();
  }
  function bindFlight(){
    document.querySelector('[data-action="pause"]')?.addEventListener('click',togglePause);
    document.querySelector('[data-action="audio"]')?.addEventListener('click',toggleAudio);
    document.querySelector('[data-action="end-flight"]')?.addEventListener('click',endFlight);
    document.querySelectorAll('[data-flight-view]').forEach(btn=>btn.addEventListener('click',()=>{ const next=btn.dataset.flightView; if(next===state.flightView)return; state.flightView=next; renderFlight(); }));
    $('volume')?.addEventListener('input',e=>{state.volume=Number(e.target.value);setAudioVolume(state.volume);});
  }

  class CabinNoise {
    constructor(){this.ctx=null;this.source=null;this.gain=null;}
    async start(volume=.22){
      if(this.source){this.setVolume(volume);return;}
      this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)(); if(this.ctx.state==='suspended')await this.ctx.resume();
      const seconds=4,length=this.ctx.sampleRate*seconds,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);let brown=0;
      for(let i=0;i<length;i++){const white=Math.random()*2-1;brown=(brown+.018*white)/1.018;data[i]=Math.max(-1,Math.min(1,brown*3.2));}
      const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const low=this.ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=1250;low.Q.value=.4;
      const rumble=this.ctx.createBiquadFilter();rumble.type='lowshelf';rumble.frequency.value=180;rumble.gain.value=5;
      const gain=this.ctx.createGain();gain.gain.value=volume;source.connect(low).connect(rumble).connect(gain).connect(this.ctx.destination);source.start();this.source=source;this.gain=gain;
    }
    stop(){try{this.source?.stop();}catch{}this.source?.disconnect();this.source=null;}
    setVolume(v){if(this.gain&&this.ctx)this.gain.gain.setTargetAtTime(Math.max(0,Math.min(1,v)),this.ctx.currentTime,.05);}
  }
  async function toggleAudio(){
    if(state.audioEnabled){stopAudio();renderFlight();return;}
    try{audio=audio||new CabinNoise();await audio.start(state.volume);state.audioEnabled=true;renderFlight();}catch{showToast('브라우저가 오디오를 차단했습니다. 페이지를 클릭한 뒤 다시 시도해 주세요.');}
  }
  function stopAudio(){audio?.stop();state.audioEnabled=false;}
  function setAudioVolume(v){audio?.setVolume(v);}
  async function shareResult(){
    const f=state.lastFlight;if(!f)return;const text=`비공: ${f.durationMinutes}분 집중 — ${f.home.code} → ${f.destination.code} · ${f.intent}`;
    if(navigator.share){try{await navigator.share({title:'비공 landing',text});return;}catch{}}
    try{await navigator.clipboard.writeText(text);showToast('결과를 클립보드에 복사했습니다.');}catch{showToast(text);}
  }
  function render(){
    clearInterval(tickTimer); destroyRouteMaps(); applyTheme();
    if(state.screen==='setup')renderSetup(); else if(state.screen==='board')renderBoarding(); else if(state.screen==='flight'){renderFlight();startTicker();} else renderLanded();
  }

  window.addEventListener('keydown',e=>{
    if(state.screen!=='flight')return;
    if(['INPUT','TEXTAREA'].includes(e.target?.tagName))return;
    if(e.key===' '){e.preventDefault();togglePause();}
    if(e.key.toLowerCase()==='m')toggleAudio();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.screen==='flight')updateFlightTelemetry();});
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

  applyTheme(); render(); loadLeaflet().catch(()=>{});
})();
