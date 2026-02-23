import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

/* ═══════════════════════════════════════════════════════════════
   DATA GENERATORS
   ═══════════════════════════════════════════════════════════════ */
const ts = (pts=60,base=50,v=20,t=0)=>{const n=Date.now();let val=base;return Array.from({length:pts},(_,i)=>{val=Math.max(0,val+(Math.random()-0.48)*v+t);return{time:new Date(n-(pts-i)*60000).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),value:Math.round(val*100)/100};});};
const genReq=(pts=60)=>{const n=Date.now();return Array.from({length:pts},(_,i)=>({time:new Date(n-(pts-i)*60000).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),"2xx":~~(Math.random()*400+600),"3xx":~~(Math.random()*50+10),"4xx":~~(Math.random()*30+5),"5xx":~~(Math.random()*8)}));};
const genEP=()=>[{endpoint:"/api/users",p50:45,p95:120,p99:340,rpm:1240},{endpoint:"/api/orders",p50:89,p95:230,p99:560,rpm:870},{endpoint:"/api/products",p50:32,p95:78,p99:190,rpm:2100},{endpoint:"/api/auth/login",p50:110,p95:340,p99:780,rpm:430},{endpoint:"/api/search",p50:156,p95:450,p99:1200,rpm:560},{endpoint:"/api/checkout",p50:200,p95:520,p99:1400,rpm:310}];

// ── Logs ──
const LL=["DEBUG","INFO","WARN","ERROR","CRITICAL"];
const LS=["php-fpm","laravel","nginx","redis","mysql","queue-worker","scheduler"];
const LM={DEBUG:["Cache key generated: user_session_a8f3c2","SQL query executed in 12ms: SELECT * FROM users WHERE id = ?","Route matched: GET /api/users/{id}","Middleware AuthCheck passed for request #48291","Template compiled: views/dashboard.blade.php","Session started: sess_kd82nf93md","Config loaded from cache","Event listener registered: OrderCreated"],INFO:["User login successful: user_id=1482 ip=192.168.1.45","Order #ORD-29481 created successfully, total=$149.99","Email dispatched to queue: welcome_email job_id=q-8291","Payment processed: stripe_pi_3N8x2k amount=$89.50","API rate limit check passed: client_id=app-382 remaining=847","File uploaded: invoice_2024.pdf size=2.4MB","Background job completed: GenerateReport duration=4.2s","Webhook received from Stripe: invoice.payment_succeeded","Cache warmed: product_catalog 1,247 items"],WARN:["Slow query detected (892ms): SELECT * FROM orders JOIN products ON...","Memory usage at 78% (624MB/800MB) - approaching threshold","Rate limit approaching for client app-382: 92% consumed","Deprecated function called: mysql_connect() in legacy/db.php:42","Disk usage at 82% on /var/log partition","Redis connection pool near capacity: 18/20 connections","Request timeout approaching: /api/search elapsed=4.2s limit=5s","Queue backlog growing: 847 pending jobs (threshold: 500)"],ERROR:["PDOException: SQLSTATE[HY000] [2002] Connection refused - mysql:3306","TypeError: Argument #1 must be of type string, null given in UserService.php:128","GuzzleHttp\\Exception: cURL error 28: Operation timed out","Redis connection failed: Connection refused [tcp://redis:6379]","Queue job failed: ProcessPayment attempts=3 job_id=q-2948","JWT token expired for user_id=2841","Validation failed: The email field is required. (422)"],CRITICAL:["FATAL: PHP-FPM pool www exhausted - max_children (32) reached","Database connection pool exhausted: 50/50 connections in use","Out of memory: Allowed memory size of 268435456 bytes exhausted","EMERGENCY: Disk full on /var/lib/mysql - writes failing","Segfault in opcache: zend_mm_heap corrupted"]};
const genLog=(id)=>{const w=[.15,.45,.20,.15,.05];let lv;const r=Math.random();let c=0;for(let i=0;i<w.length;i++){c+=w[i];if(r<c){lv=LL[i];break;}}const ms=LM[lv];const m=ms[~~(Math.random()*ms.length)];const s=LS[~~(Math.random()*LS.length)];const d=new Date();d.setSeconds(d.getSeconds()-~~(Math.random()*300));return{id,timestamp:d.toISOString(),level:lv,source:s,message:m,traceId:`trace-${Math.random().toString(36).substr(2,12)}`,duration:lv==="WARN"||lv==="ERROR"?`${(Math.random()*4e3+100).toFixed(0)}ms`:`${(Math.random()*200+5).toFixed(0)}ms`};};
const genLogBatch=(n=50)=>Array.from({length:n},(_,i)=>genLog(i));
const genLogVol=(pts=60)=>{const n=Date.now();return Array.from({length:pts},(_,i)=>({time:new Date(n-(pts-i)*60000).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),DEBUG:~~(Math.random()*80+20),INFO:~~(Math.random()*200+100),WARN:~~(Math.random()*40+10),ERROR:~~(Math.random()*20+3),CRITICAL:~~(Math.random()*4)}));};
const genErrGrp=()=>[{error:"PDOException: Connection refused",count:847,firstSeen:"2h ago",lastSeen:"12s ago",source:"mysql",trend:"rising"},{error:"TypeError: Argument #1 must be string",count:234,firstSeen:"6h ago",lastSeen:"2m ago",source:"laravel",trend:"stable"},{error:"GuzzleHttp: Operation timed out",count:189,firstSeen:"1h ago",lastSeen:"45s ago",source:"php-fpm",trend:"rising"},{error:"Queue job failed: ProcessPayment",count:56,firstSeen:"30m ago",lastSeen:"5m ago",source:"queue-worker",trend:"falling"},{error:"JWT token expired",count:1204,firstSeen:"12h ago",lastSeen:"3s ago",source:"laravel",trend:"stable"},{error:"Redis connection failed",count:78,firstSeen:"45m ago",lastSeen:"8m ago",source:"redis",trend:"falling"},{error:"Out of memory: 268435456 bytes",count:12,firstSeen:"20m ago",lastSeen:"18m ago",source:"php-fpm",trend:"spike"}];

// ── AWS Generators ──
const genEKS = () => ({
  pods: ts(60, 24, 6),
  podStatus: { running: 22 + ~~(Math.random()*4), pending: ~~(Math.random()*3), failed: ~~(Math.random()*2), succeeded: ~~(Math.random()*5+5) },
  cpuRequest: ts(60, 62, 10),
  memRequest: ts(60, 71, 8),
  networkIn: ts(60, 450, 120),
  networkOut: ts(60, 280, 80),
  nodes: [
    { name: "ip-10-0-1-42.ec2", status: "Ready", cpu: (30+Math.random()*35).toFixed(1), mem: (55+Math.random()*25).toFixed(1), pods: 8+~~(Math.random()*4), age: "14d" },
    { name: "ip-10-0-2-87.ec2", status: "Ready", cpu: (25+Math.random()*40).toFixed(1), mem: (50+Math.random()*30).toFixed(1), pods: 6+~~(Math.random()*5), age: "14d" },
    { name: "ip-10-0-3-15.ec2", status: "Ready", cpu: (20+Math.random()*30).toFixed(1), mem: (45+Math.random()*20).toFixed(1), pods: 5+~~(Math.random()*6), age: "7d" },
    { name: "ip-10-0-1-93.ec2", status: Math.random()>0.9?"NotReady":"Ready", cpu: (35+Math.random()*30).toFixed(1), mem: (60+Math.random()*20).toFixed(1), pods: 7+~~(Math.random()*3), age: "3d" },
  ],
  deployments: [
    { name: "php-app", ready: "3/3", upToDate: 3, available: 3, age: "14d" },
    { name: "queue-worker", ready: "2/2", upToDate: 2, available: 2, age: "14d" },
    { name: "scheduler", ready: "1/1", upToDate: 1, available: 1, age: "14d" },
    { name: "nginx-ingress", ready: "2/2", upToDate: 2, available: 2, age: "30d" },
  ],
  hpaMetrics: ts(60, 45, 15),
  restarts: ~~(Math.random()*8),
  clusterName: "prod-eks-cluster",
  region: "us-east-1",
  version: "1.29",
});

const genRDS = () => ({
  cpuUtil: ts(60, 35, 15),
  freeMemory: ts(60, 12.4, 2, -0.01),
  connections: ts(60, 42, 12),
  readIOPS: ts(60, 1800, 600),
  writeIOPS: ts(60, 950, 300),
  readLatency: ts(60, 2.1, 1.2),
  writeLatency: ts(60, 3.8, 2),
  replicaLag: ts(60, 0.8, 0.5),
  freeStorage: (120 + Math.random()*30).toFixed(1),
  engine: "MySQL 8.0.35",
  instanceClass: "db.r6g.xlarge",
  status: "available",
  multiAZ: true,
  readReplicas: 2,
  instanceId: "prod-php-app-db",
  slowQueries: ts(60, 3, 4),
  deadlocks: ~~(Math.random()*3),
  abortedConnections: ~~(Math.random()*12+2),
});

const genSQS = () => ({
  queues: [
    { name: "prod-email-queue", messagesVisible: ~~(Math.random()*200+50), messagesInFlight: ~~(Math.random()*30+5), messagesSent: ~~(Math.random()*500+200), messagesReceived: ~~(Math.random()*480+180), messagesDeleted: ~~(Math.random()*470+175), oldestMessage: `${~~(Math.random()*120+10)}s`, dlqCount: ~~(Math.random()*8), type: "Standard" },
    { name: "prod-payment-queue", messagesVisible: ~~(Math.random()*50+5), messagesInFlight: ~~(Math.random()*15+2), messagesSent: ~~(Math.random()*200+100), messagesReceived: ~~(Math.random()*195+95), messagesDeleted: ~~(Math.random()*190+90), oldestMessage: `${~~(Math.random()*60+5)}s`, dlqCount: ~~(Math.random()*3), type: "FIFO" },
    { name: "prod-notification-queue", messagesVisible: ~~(Math.random()*400+100), messagesInFlight: ~~(Math.random()*50+10), messagesSent: ~~(Math.random()*800+400), messagesReceived: ~~(Math.random()*750+350), messagesDeleted: ~~(Math.random()*740+340), oldestMessage: `${~~(Math.random()*300+30)}s`, dlqCount: ~~(Math.random()*15), type: "Standard" },
    { name: "prod-analytics-queue", messagesVisible: ~~(Math.random()*1000+200), messagesInFlight: ~~(Math.random()*80+20), messagesSent: ~~(Math.random()*1500+500), messagesReceived: ~~(Math.random()*1400+450), messagesDeleted: ~~(Math.random()*1380+440), oldestMessage: `${~~(Math.random()*600+60)}s`, dlqCount: ~~(Math.random()*25), type: "Standard" },
  ],
  totalVisible: ts(60, 800, 300),
  totalSent: ts(60, 3000, 800),
  totalDLQ: ts(60, 12, 8),
  processingRate: ts(60, 2800, 700),
});

const genS3 = () => ({
  buckets: [
    { name: "prod-app-assets", size: "284.7 GB", objects: "1,247,832", requests: ~~(Math.random()*5000+2000), errors4xx: ~~(Math.random()*30+5), errors5xx: ~~(Math.random()*3), bandwidth: `${(Math.random()*50+10).toFixed(1)} GB`, storageClass: "Standard", versioning: true },
    { name: "prod-user-uploads", size: "1.2 TB", objects: "3,891,204", requests: ~~(Math.random()*8000+3000), errors4xx: ~~(Math.random()*50+10), errors5xx: ~~(Math.random()*5), bandwidth: `${(Math.random()*120+30).toFixed(1)} GB`, storageClass: "Standard-IA", versioning: true },
    { name: "prod-backups", size: "4.8 TB", objects: "12,482", requests: ~~(Math.random()*200+50), errors4xx: ~~(Math.random()*5), errors5xx: 0, bandwidth: `${(Math.random()*5+1).toFixed(1)} GB`, storageClass: "Glacier", versioning: false },
    { name: "prod-logs", size: "892.3 GB", objects: "28,491,023", requests: ~~(Math.random()*15000+5000), errors4xx: ~~(Math.random()*20+2), errors5xx: ~~(Math.random()*2), bandwidth: `${(Math.random()*80+20).toFixed(1)} GB`, storageClass: "Standard", versioning: false },
  ],
  totalRequests: ts(60, 25000, 8000),
  getVsPut: (pts=60)=>{const n=Date.now();return Array.from({length:pts},(_,i)=>({time:new Date(n-(pts-i)*60000).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),GET:~~(Math.random()*18000+8000),PUT:~~(Math.random()*4000+1000),DELETE:~~(Math.random()*500+50)}));},
  errorRate: ts(60, 0.12, 0.08),
  latency: ts(60, 45, 20),
  totalSize: "7.3 TB",
  totalObjects: "33.6M",
  monthlyCost: "$" + (Math.random()*200+350).toFixed(2),
});

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */
const C={bg:"#0b0e14",panel:"#141821",panelBorder:"#1e2535",text:"#c7d0de",textMuted:"#6b7a94",green:"#73bf69",yellow:"#fade2a",orange:"#ff9830",red:"#f2495c",blue:"#5794f2",purple:"#b877d9",cyan:"#8ab8ff",gridLine:"#1a2030",aws:"#ff9900"};
const PIE_C=[C.green,C.blue,C.orange,C.red];
const LOG_C={DEBUG:"#6b7a94",INFO:"#5794f2",WARN:"#fade2a",ERROR:"#ff9830",CRITICAL:"#f2495c"};

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
const StatPanel=({title,value,unit,subtitle,color=C.green,sparkData})=>(
  <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 18px",display:"flex",flexDirection:"column",gap:4,position:"relative",overflow:"hidden"}}>
    <div style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.5px",fontFamily:"monospace"}}>{title}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:4}}>
      <span style={{fontSize:32,fontWeight:700,color,fontFamily:"monospace",lineHeight:1}}>{value}</span>
      {unit&&<span style={{fontSize:13,color:C.textMuted,fontFamily:"monospace"}}>{unit}</span>}
    </div>
    {subtitle&&<div style={{fontSize:11,color:C.textMuted}}>{subtitle}</div>}
    {sparkData&&<div style={{position:"absolute",bottom:0,right:0,width:"45%",height:"50%",opacity:0.3}}><ResponsiveContainer><AreaChart data={sparkData.slice(-20)}><Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.3} strokeWidth={1.5} dot={false}/></AreaChart></ResponsiveContainer></div>}
  </div>
);

const PH=({title,subtitle,live=true,extra})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"0 2px"}}>
    <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{title}</div>{subtitle&&<div style={{fontSize:10,color:C.textMuted,marginTop:1}}>{subtitle}</div>}</div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>{extra}{live&&<><div style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/><span style={{fontSize:10,color:C.textMuted}}>LIVE</span></>}</div>
  </div>
);

const CP=({title,subtitle,children,height=220,extra})=>(
  <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 12px 8px",height}}>
    <PH title={title} subtitle={subtitle} extra={extra}/><div style={{height:height-60}}>{children}</div>
  </div>
);

const CT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#1c2333",border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"8px 12px",fontSize:11,fontFamily:"monospace"}}><div style={{color:C.textMuted,marginBottom:4}}>{label}</div>{payload.map((p,i)=>(<div key={i} style={{color:p.color,display:"flex",gap:8,justifyContent:"space-between"}}><span>{p.name||p.dataKey}</span><span style={{fontWeight:600}}>{typeof p.value==="number"?p.value.toFixed(1):p.value}</span></div>))}</div>);};

const SB=({status})=>{const c={healthy:C.green,warning:C.yellow,critical:C.red,Ready:C.green,NotReady:C.red,available:C.green,degraded:C.orange};return<span style={{background:`${c[status]||C.green}22`,color:c[status]||C.green,border:`1px solid ${c[status]||C.green}44`,borderRadius:3,padding:"2px 8px",fontSize:10,fontWeight:600,textTransform:"uppercase",fontFamily:"monospace"}}>{status}</span>;};

const LB=({level})=>(<span style={{background:`${LOG_C[level]}18`,color:LOG_C[level],border:`1px solid ${LOG_C[level]}44`,borderRadius:3,padding:"1px 6px",fontSize:10,fontWeight:700,fontFamily:"monospace",minWidth:62,textAlign:"center",display:"inline-block"}}>{level}</span>);

const TI=({trend})=>{const cfg={rising:{s:"▲",c:C.red},falling:{s:"▼",c:C.green},stable:{s:"●",c:C.yellow},spike:{s:"⚡",c:C.red}};const t=cfg[trend]||cfg.stable;return<span style={{color:t.c,fontSize:11,fontFamily:"monospace",fontWeight:600}}>{t.s} {trend}</span>;};

const AwsIcon=({size=16})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M6.5 17.5c-1.5-.7-2.5-1.5-3.2-2.3-.2-.2-.1-.5.1-.6.2-.1.4-.1.6.1.6.7 1.5 1.4 2.8 2 .2.1.3.3.2.5-.1.3-.3.4-.5.3z" fill={C.aws}/><path d="M8 18c3.5 1.2 7.5.8 10.5-1.2.3-.2.6 0 .6.3 0 .2-.1.3-.2.4C15.5 19.8 11 20.2 7.3 18.8c-.3-.1-.3-.4-.2-.6.1-.2.5-.3.9-.2z" fill={C.aws}/><path d="M19.5 16.5c.2-.3.7-1 .8-1.4.1-.2.3-.2.5-.1.2.1.2.3.1.5-.2.5-.7 1.2-.9 1.5-.1.2-.4.2-.5.1-.2-.2-.2-.4 0-.6z" fill={C.aws}/><path d="M7.6 11.3c0-1 .1-2.1.5-3 .3-.7.9-1.3 1.6-1.5.8-.3 1.6-.1 2.2.4.7.6 1 1.4 1.2 2.3.6-.1 1.2-.1 1.7.2.6.3.9.9 1 1.5.5-.1 1.1 0 1.5.3.5.4.7 1 .7 1.6 0 .7-.3 1.3-.8 1.7-.5.3-1.1.5-1.7.5H8.8c-.7 0-1.3-.3-1.7-.8-.5-.6-.6-1.3-.5-2v-.2z" fill={C.aws}/></svg>);

/* ═══════════════════════════════════════════════════════════════
   LIVE LOG STREAM
   ═══════════════════════════════════════════════════════════════ */
const LiveLogStream=({logs,filter,searchTerm})=>{
  const ref=useRef(null);const[as,setAs]=useState(true);
  useEffect(()=>{if(as&&ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[logs,as]);
  const f=logs.filter(l=>(filter==="ALL"||l.level===filter)&&(!searchTerm||l.message.toLowerCase().includes(searchTerm.toLowerCase())||l.source.toLowerCase().includes(searchTerm.toLowerCase())));
  return(<div ref={ref} onScroll={e=>{const{scrollTop,scrollHeight,clientHeight}=e.target;setAs(scrollHeight-scrollTop-clientHeight<40);}} style={{height:"100%",overflowY:"auto",fontFamily:"monospace",fontSize:11,lineHeight:1.6,background:"#0a0d12",borderRadius:4,padding:"6px 0"}}>
    {f.map((l,i)=>(<div key={l.id+"-"+i} style={{padding:"3px 10px",display:"flex",gap:8,alignItems:"flex-start",borderLeft:`3px solid ${LOG_C[l.level]}33`,background:l.level==="CRITICAL"?`${C.red}08`:l.level==="ERROR"?`${C.orange}05`:"transparent"}} onMouseEnter={e=>e.currentTarget.style.background=`${C.blue}11`} onMouseLeave={e=>e.currentTarget.style.background=l.level==="CRITICAL"?`${C.red}08`:l.level==="ERROR"?`${C.orange}05`:"transparent"}>
      <span style={{color:C.textMuted,whiteSpace:"nowrap",minWidth:72,fontSize:10}}>{new Date(l.timestamp).toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
      <LB level={l.level}/><span style={{color:C.cyan,minWidth:85,fontSize:10}}>[{l.source}]</span>
      <span style={{color:l.level==="CRITICAL"?C.red:l.level==="ERROR"?C.orange:C.text,wordBreak:"break-all",flex:1,fontWeight:l.level==="CRITICAL"?600:400}}>{l.message}</span>
      <span style={{color:C.textMuted,fontSize:9,whiteSpace:"nowrap",opacity:.6}}>{l.duration}</span>
    </div>))}
    {!as&&<div onClick={()=>{setAs(true);ref.current.scrollTop=ref.current.scrollHeight;}} style={{position:"sticky",bottom:4,margin:"4px auto",width:"fit-content",background:C.blue,color:"#fff",padding:"4px 14px",borderRadius:12,fontSize:10,cursor:"pointer",fontWeight:600}}>▼ New logs</div>}
  </div>);
};

/* ═══════════════════════════════════════════════════════════════
   AWS TAB COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const AwsTab=({eks,rds,sqs,s3})=>{
  const [awsSub,setAwsSub]=useState("eks");
  const sub=(id,label,emoji)=>(<button key={id} onClick={()=>setAwsSub(id)} style={{background:awsSub===id?`${C.aws}22`:"transparent",color:awsSub===id?C.aws:C.textMuted,border:`1px solid ${awsSub===id?C.aws+"66":C.panelBorder}`,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:awsSub===id?700:400,borderRadius:4,transition:"all 0.2s"}}>{emoji} {label}</button>);

  return (<>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{sub("eks","EKS","☸️")}{sub("rds","RDS","🗄️")}{sub("sqs","SQS","📨")}{sub("s3","S3","🪣")}</div>

    {/* ── EKS ── */}
    {awsSub==="eks"&&(<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        <StatPanel title="Cluster" value={eks.clusterName} unit="" subtitle={`${eks.region} • v${eks.version}`} color={C.aws}/>
        <StatPanel title="Running Pods" value={eks.podStatus.running} unit="pods" subtitle={`${eks.podStatus.pending} pending`} color={C.green} sparkData={eks.pods}/>
        <StatPanel title="Failed Pods" value={eks.podStatus.failed} unit="" subtitle="needs attention" color={eks.podStatus.failed>0?C.red:C.green}/>
        <StatPanel title="Restarts" value={eks.restarts} unit="today" subtitle="container restarts" color={eks.restarts>5?C.orange:C.green}/>
        <StatPanel title="Nodes" value={eks.nodes.length} unit="active" subtitle={`${eks.nodes.filter(n=>n.status==="Ready").length} ready`} color={C.blue}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="EKS CPU Utilization" subtitle="Cluster-wide CPU request %" height={220}>
          <ResponsiveContainer><AreaChart data={eks.cpuRequest}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[0,100]}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.aws} fill={C.aws} fillOpacity={0.2} strokeWidth={2} name="CPU %"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="EKS Memory Utilization" subtitle="Cluster-wide memory request %" height={220}>
          <ResponsiveContainer><AreaChart data={eks.memRequest}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[0,100]}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.purple} fill={C.purple} fillOpacity={0.2} strokeWidth={2} name="Memory %"/></AreaChart></ResponsiveContainer>
        </CP>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="Network I/O" subtitle="Bytes in/out per second" height={200}>
          <ResponsiveContainer><AreaChart data={eks.networkIn.map((d,i)=>({...d,out:eks.networkOut[i]?.value||0}))}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.cyan} fill={C.cyan} fillOpacity={0.15} strokeWidth={2} name="In (KB/s)"/><Area type="monotone" dataKey="out" stroke={C.orange} fill={C.orange} fillOpacity={0.15} strokeWidth={2} name="Out (KB/s)"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="HPA Target Utilization" subtitle="Horizontal Pod Autoscaler CPU target" height={200}>
          <ResponsiveContainer><LineChart data={eks.hpaMetrics}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[0,100]}/><Tooltip content={<CT/>}/><Line type="monotone" dataKey="value" stroke={C.yellow} strokeWidth={2} dot={false} name="CPU Target %"/></LineChart></ResponsiveContainer>
        </CP>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}>
          <PH title="Nodes" subtitle="EKS worker node status"/>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Node","Status","CPU %","Mem %","Pods","Age"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{eks.nodes.map((n,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.panelBorder}22`}}><td style={{padding:"8px 8px",color:C.cyan,fontSize:10}}>{n.name}</td><td style={{padding:"8px 8px"}}><SB status={n.status}/></td><td style={{padding:"8px 8px",color:parseFloat(n.cpu)>70?C.red:parseFloat(n.cpu)>50?C.orange:C.green}}>{n.cpu}%</td><td style={{padding:"8px 8px",color:parseFloat(n.mem)>80?C.red:parseFloat(n.mem)>60?C.orange:C.green}}>{n.mem}%</td><td style={{padding:"8px 8px",color:C.text}}>{n.pods}</td><td style={{padding:"8px 8px",color:C.textMuted}}>{n.age}</td></tr>))}</tbody></table>
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}>
          <PH title="Deployments" subtitle="Kubernetes deployment status"/>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Name","Ready","Up-to-date","Available","Age"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{eks.deployments.map((d,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.panelBorder}22`}}><td style={{padding:"8px 8px",color:C.aws}}>{d.name}</td><td style={{padding:"8px 8px",color:C.green}}>{d.ready}</td><td style={{padding:"8px 8px",color:C.text}}>{d.upToDate}</td><td style={{padding:"8px 8px",color:C.green}}>{d.available}</td><td style={{padding:"8px 8px",color:C.textMuted}}>{d.age}</td></tr>))}</tbody></table>
        </div>
      </div>
    </>)}

    {/* ── RDS ── */}
    {awsSub==="rds"&&(<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12}}>
        <StatPanel title="Instance" value={rds.instanceId} unit="" subtitle={rds.engine} color={C.aws}/>
        <StatPanel title="Status" value={rds.status} unit="" subtitle={`${rds.instanceClass}`} color={C.green}/>
        <StatPanel title="Free Storage" value={rds.freeStorage} unit="GB" subtitle="remaining" color={parseFloat(rds.freeStorage)<50?C.red:C.green}/>
        <StatPanel title="Connections" value={rds.connections.slice(-1)[0]?.value.toFixed(0)} unit="active" subtitle={`${rds.abortedConnections} aborted`} color={C.blue} sparkData={rds.connections}/>
        <StatPanel title="Multi-AZ" value={rds.multiAZ?"Yes":"No"} unit="" subtitle={`${rds.readReplicas} read replicas`} color={C.green}/>
        <StatPanel title="Deadlocks" value={rds.deadlocks} unit="today" subtitle="lock conflicts" color={rds.deadlocks>2?C.red:C.green}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="RDS CPU Utilization" subtitle="Database instance CPU %" height={220}>
          <ResponsiveContainer><AreaChart data={rds.cpuUtil}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[0,100]}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.aws} fill={C.aws} fillOpacity={0.2} strokeWidth={2} name="CPU %"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="Freeable Memory" subtitle="Available RAM (GB)" height={220}>
          <ResponsiveContainer><AreaChart data={rds.freeMemory}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.cyan} fill={C.cyan} fillOpacity={0.2} strokeWidth={2} name="Free Memory (GB)"/></AreaChart></ResponsiveContainer>
        </CP>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="Read / Write IOPS" subtitle="I/O operations per second" height={220}>
          <ResponsiveContainer><AreaChart data={rds.readIOPS.map((d,i)=>({...d,write:rds.writeIOPS[i]?.value||0}))}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} name="Read IOPS"/><Area type="monotone" dataKey="write" stroke={C.orange} fill={C.orange} fillOpacity={0.15} strokeWidth={2} name="Write IOPS"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="Read / Write Latency" subtitle="Milliseconds" height={220}>
          <ResponsiveContainer><LineChart data={rds.readLatency.map((d,i)=>({...d,write:rds.writeLatency[i]?.value||0}))}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Line type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} dot={false} name="Read (ms)"/><Line type="monotone" dataKey="write" stroke={C.orange} strokeWidth={2} dot={false} name="Write (ms)"/></LineChart></ResponsiveContainer>
        </CP>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="Replica Lag" subtitle="Seconds behind primary" height={200}>
          <ResponsiveContainer><AreaChart data={rds.replicaLag}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.yellow} fill={C.yellow} fillOpacity={0.2} strokeWidth={2} name="Lag (s)"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="Slow Queries" subtitle="Queries exceeding threshold per minute" height={200}>
          <ResponsiveContainer><BarChart data={rds.slowQueries.slice(-20)}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={3}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Bar dataKey="value" fill={C.red} radius={[2,2,0,0]} name="Slow Queries"/></BarChart></ResponsiveContainer>
        </CP>
      </div>
    </>)}

    {/* ── SQS ── */}
    {awsSub==="sqs"&&(<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <StatPanel title="Total Visible" value={sqs.queues.reduce((a,q)=>a+q.messagesVisible,0).toLocaleString()} unit="msgs" subtitle="across all queues" color={C.aws} sparkData={sqs.totalVisible}/>
        <StatPanel title="In Flight" value={sqs.queues.reduce((a,q)=>a+q.messagesInFlight,0).toLocaleString()} unit="msgs" subtitle="being processed" color={C.blue}/>
        <StatPanel title="Throughput" value={sqs.queues.reduce((a,q)=>a+q.messagesSent,0).toLocaleString()} unit="sent/min" subtitle="messages sent" color={C.green} sparkData={sqs.totalSent}/>
        <StatPanel title="DLQ Messages" value={sqs.queues.reduce((a,q)=>a+q.dlqCount,0)} unit="failed" subtitle="dead letter queue" color={sqs.queues.reduce((a,q)=>a+q.dlqCount,0)>20?C.red:C.orange} sparkData={sqs.totalDLQ}/>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}>
        <PH title="Queue Details" subtitle="All SQS queues"/>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Queue","Type","Visible","In Flight","Sent/min","Received/min","Oldest Msg","DLQ"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{sqs.queues.map((q,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.panelBorder}22`}}><td style={{padding:"8px",color:C.aws}}>{q.name}</td><td style={{padding:"8px"}}><span style={{background:q.type==="FIFO"?`${C.purple}22`:`${C.blue}22`,color:q.type==="FIFO"?C.purple:C.blue,padding:"1px 6px",borderRadius:3,fontSize:9}}>{q.type}</span></td><td style={{padding:"8px",color:q.messagesVisible>500?C.red:q.messagesVisible>100?C.orange:C.text,fontWeight:700}}>{q.messagesVisible.toLocaleString()}</td><td style={{padding:"8px",color:C.text}}>{q.messagesInFlight}</td><td style={{padding:"8px",color:C.green}}>{q.messagesSent.toLocaleString()}</td><td style={{padding:"8px",color:C.text}}>{q.messagesReceived.toLocaleString()}</td><td style={{padding:"8px",color:parseInt(q.oldestMessage)>120?C.red:parseInt(q.oldestMessage)>60?C.orange:C.textMuted}}>{q.oldestMessage}</td><td style={{padding:"8px",color:q.dlqCount>10?C.red:q.dlqCount>0?C.orange:C.green,fontWeight:700}}>{q.dlqCount}</td></tr>))}</tbody></table>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="Messages Visible" subtitle="Total messages waiting across queues" height={220}>
          <ResponsiveContainer><AreaChart data={sqs.totalVisible}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.aws} fill={C.aws} fillOpacity={0.2} strokeWidth={2} name="Visible Messages"/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="Processing Rate vs Sent" subtitle="Messages per minute" height={220}>
          <ResponsiveContainer><AreaChart data={sqs.totalSent.map((d,i)=>({...d,processed:sqs.processingRate[i]?.value||0}))}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.blue} fill={C.blue} fillOpacity={0.15} strokeWidth={2} name="Sent/min"/><Area type="monotone" dataKey="processed" stroke={C.green} fill={C.green} fillOpacity={0.15} strokeWidth={2} name="Processed/min"/></AreaChart></ResponsiveContainer>
        </CP>
      </div>
    </>)}

    {/* ── S3 ── */}
    {awsSub==="s3"&&(<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <StatPanel title="Total Storage" value={s3.totalSize} unit="" subtitle={`${s3.totalObjects} objects`} color={C.aws}/>
        <StatPanel title="Requests/min" value={s3.buckets.reduce((a,b)=>a+b.requests,0).toLocaleString()} unit="req" subtitle="across all buckets" color={C.blue} sparkData={s3.totalRequests}/>
        <StatPanel title="Error Rate" value={s3.errorRate.slice(-1)[0]?.value.toFixed(3)} unit="%" subtitle="4xx + 5xx" color={C.green} sparkData={s3.errorRate}/>
        <StatPanel title="Est. Monthly Cost" value={s3.monthlyCost} unit="" subtitle="storage + requests" color={C.aws}/>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}>
        <PH title="S3 Buckets" subtitle="Storage and request metrics per bucket"/>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Bucket","Size","Objects","Requests/min","4xx Errors","5xx Errors","Bandwidth","Class","Versioning"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{s3.buckets.map((b,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.panelBorder}22`}}><td style={{padding:"8px",color:C.aws}}>{b.name}</td><td style={{padding:"8px",color:C.text}}>{b.size}</td><td style={{padding:"8px",color:C.textMuted}}>{b.objects}</td><td style={{padding:"8px",color:C.text}}>{b.requests.toLocaleString()}</td><td style={{padding:"8px",color:b.errors4xx>30?C.orange:C.textMuted}}>{b.errors4xx}</td><td style={{padding:"8px",color:b.errors5xx>0?C.red:C.green}}>{b.errors5xx}</td><td style={{padding:"8px",color:C.text}}>{b.bandwidth}</td><td style={{padding:"8px"}}><span style={{background:`${C.blue}22`,color:C.blue,padding:"1px 6px",borderRadius:3,fontSize:9}}>{b.storageClass}</span></td><td style={{padding:"8px",color:b.versioning?C.green:C.textMuted}}>{b.versioning?"✓ On":"Off"}</td></tr>))}</tbody></table>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <CP title="Request Types" subtitle="GET / PUT / DELETE operations per minute" height={220}>
          <ResponsiveContainer><AreaChart data={s3.getVsPut()}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="GET" stackId="1" stroke={C.green} fill={C.green} fillOpacity={0.3}/><Area type="monotone" dataKey="PUT" stackId="1" stroke={C.blue} fill={C.blue} fillOpacity={0.3}/><Area type="monotone" dataKey="DELETE" stackId="1" stroke={C.red} fill={C.red} fillOpacity={0.3}/></AreaChart></ResponsiveContainer>
        </CP>
        <CP title="S3 Latency" subtitle="First byte latency (ms)" height={220}>
          <ResponsiveContainer><LineChart data={s3.latency}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Line type="monotone" dataKey="value" stroke={C.aws} strokeWidth={2} dot={false} name="Latency (ms)"/></LineChart></ResponsiveContainer>
        </CP>
      </div>
    </>)}
  </>);
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
export default function GrafanaDashboard(){
  const[data,setData]=useState(null);
  const[timeRange,setTimeRange]=useState("1h");
  const[refreshing,setRefreshing]=useState(false);
  const[logs,setLogs]=useState(()=>genLogBatch(80));
  const[logFilter,setLogFilter]=useState("ALL");
  const[logSearch,setLogSearch]=useState("");
  const[activeTab,setActiveTab]=useState("metrics");
  const[expandedLog,setExpandedLog]=useState(null);

  const gen=useCallback(()=>({
    requestRate:ts(60,1050,200),responseTime:ts(60,85,30),errorRate:ts(60,2.1,1.5),
    memoryUsage:ts(60,68,8,0.05),cpuUsage:ts(60,35,15),dbConnections:ts(60,18,5),
    httpCodes:genReq(60),endpoints:genEP(),logVolume:genLogVol(60),errorGroups:genErrGrp(),
    cacheHitRatio:(Math.random()*5+92).toFixed(1),activeWorkers:~~(Math.random()*4+12),
    queueDepth:~~(Math.random()*20+5),uptime:"14d 7h 23m",
    eks:genEKS(),rds:genRDS(),sqs:genSQS(),s3:genS3(),
  }),[]);

  useEffect(()=>{
    setData(gen());
    const di=setInterval(()=>{setRefreshing(true);setTimeout(()=>{setData(gen());setRefreshing(false);},300);},5000);
    const li=setInterval(()=>{const nl=Array.from({length:~~(Math.random()*4)+1},(_,i)=>genLog(Date.now()+i));setLogs(p=>[...p.slice(-200),...nl]);},1500);
    return()=>{clearInterval(di);clearInterval(li);};
  },[gen]);

  if(!data)return null;

  const avgResp=data.responseTime.slice(-10).reduce((s,d)=>s+d.value,0)/10;
  const curRPS=data.requestRate.slice(-1)[0]?.value||0;
  const curErr=data.errorRate.slice(-1)[0]?.value||0;
  const curMem=data.memoryUsage.slice(-1)[0]?.value||0;
  const scTot=data.httpCodes.reduce((a,d)=>{a["2xx"]+=d["2xx"];a["3xx"]+=d["3xx"];a["4xx"]+=d["4xx"];a["5xx"]+=d["5xx"];return a;},{"2xx":0,"3xx":0,"4xx":0,"5xx":0});
  const pieData=Object.entries(scTot).map(([n,v])=>({name:n,value:v}));
  const logCounts=logs.reduce((a,l)=>{a[l.level]=(a[l.level]||0)+1;return a;},{});
  const totalLogs=logs.length;
  const errCnt=(logCounts.ERROR||0)+(logCounts.CRITICAL||0);

  const tabBtn=(id,label)=>(<button key={id} onClick={()=>setActiveTab(id)} style={{background:activeTab===id?`${id==="aws"?C.aws:C.blue}33`:"transparent",color:activeTab===id?(id==="aws"?C.aws:C.blue):C.textMuted,border:"none",padding:"6px 16px",fontSize:12,cursor:"pointer",fontWeight:activeTab===id?700:400,borderBottom:activeTab===id?`2px solid ${id==="aws"?C.aws:C.blue}`:"2px solid transparent",transition:"all 0.2s",fontFamily:"monospace"}}>{label}</button>);

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Inter',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.panelBorder};border-radius:3px}input::placeholder{color:${C.textMuted}}`}</style>

      {/* Header */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.panelBorder}`,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke={C.orange} strokeWidth="2.5"/><circle cx="14" cy="14" r="5" fill={C.orange}/><line x1="14" y1="2" x2="14" y2="6" stroke={C.orange} strokeWidth="2"/><line x1="14" y1="22" x2="14" y2="26" stroke={C.orange} strokeWidth="2"/><line x1="2" y1="14" x2="6" y2="14" stroke={C.orange} strokeWidth="2"/><line x1="22" y1="14" x2="26" y2="14" stroke={C.orange} strokeWidth="2"/></svg>
          <div><span style={{fontSize:16,fontWeight:700}}>PHP Application Dashboard</span><span style={{fontSize:11,color:C.textMuted,marginLeft:10,fontFamily:"monospace"}}>production / php-app-cluster</span></div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{display:"flex",border:`1px solid ${C.panelBorder}`,borderRadius:4,overflow:"hidden"}}>{["15m","1h","6h","24h"].map(r=>(<button key={r} onClick={()=>setTimeRange(r)} style={{background:timeRange===r?C.blue+"33":"transparent",color:timeRange===r?C.blue:C.textMuted,border:"none",padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"monospace",fontWeight:timeRange===r?600:400,borderRight:`1px solid ${C.panelBorder}`}}>{r}</button>))}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",background:refreshing?C.blue+"22":"transparent",border:`1px solid ${C.panelBorder}`,borderRadius:4,transition:"all 0.3s"}}><div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}66`}}/><span style={{fontSize:11,color:C.textMuted,fontFamily:"monospace"}}>{refreshing?"Refreshing...":"Auto 5s"}</span></div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.panelBorder}`,padding:"0 20px",display:"flex",gap:0}}>
        {tabBtn("metrics","📊 Metrics")}{tabBtn("logs",`📋 Logs ${errCnt>0?`(${errCnt})`:""}`)}
        {tabBtn("aws","☁️ AWS")}{tabBtn("all","🔍 Full View")}
      </div>

      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>

        {/* Stat Row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12}}>
          <StatPanel title="Request Rate" value={curRPS.toFixed(0)} unit="req/s" subtitle="avg last 5m" color={C.blue} sparkData={data.requestRate}/>
          <StatPanel title="Avg Response" value={avgResp.toFixed(0)} unit="ms" subtitle="p50 latency" color={avgResp>150?C.orange:C.green} sparkData={data.responseTime}/>
          <StatPanel title="Error Rate" value={curErr.toFixed(2)} unit="%" subtitle="5xx responses" color={curErr>5?C.red:C.green} sparkData={data.errorRate}/>
          <StatPanel title="Memory" value={curMem.toFixed(1)} unit="%" subtitle="heap usage" color={curMem>85?C.red:curMem>70?C.orange:C.green} sparkData={data.memoryUsage}/>
          <StatPanel title="Log Volume" value={totalLogs} unit="lines" subtitle={`${errCnt} errors`} color={errCnt>20?C.red:C.blue}/>
          <StatPanel title="Uptime" value={data.uptime} unit="" subtitle="last restart" color={C.green}/>
        </div>

        {/* ── METRICS ── */}
        {(activeTab==="metrics"||activeTab==="all")&&(<>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
            <CP title="HTTP Request Rate" subtitle="Requests per second by status code" height={260}><ResponsiveContainer><AreaChart data={data.httpCodes}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="2xx" stackId="1" stroke={C.green} fill={C.green} fillOpacity={0.4}/><Area type="monotone" dataKey="3xx" stackId="1" stroke={C.blue} fill={C.blue} fillOpacity={0.4}/><Area type="monotone" dataKey="4xx" stackId="1" stroke={C.orange} fill={C.orange} fillOpacity={0.4}/><Area type="monotone" dataKey="5xx" stackId="1" stroke={C.red} fill={C.red} fillOpacity={0.4}/></AreaChart></ResponsiveContainer></CP>
            <CP title="Status Code Distribution" subtitle="Last 1 hour" height={260}><ResponsiveContainer><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">{pieData.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}</Pie><Tooltip content={<CT/>}/></PieChart></ResponsiveContainer><div style={{display:"flex",justifyContent:"center",gap:14,marginTop:-8}}>{pieData.map((d,i)=>(<div key={d.name} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:8,height:8,borderRadius:2,background:PIE_C[i]}}/><span style={{color:C.textMuted}}>{d.name}</span></div>))}</div></CP>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <CP title="Response Time" subtitle="Milliseconds (p50)" height={220}><ResponsiveContainer><LineChart data={data.responseTime}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Line type="monotone" dataKey="value" stroke={C.yellow} strokeWidth={2} dot={false} name="p50 (ms)"/></LineChart></ResponsiveContainer></CP>
            <CP title="CPU & Memory Usage" subtitle="Percentage" height={220}><ResponsiveContainer><AreaChart data={data.cpuUsage.map((d,i)=>({...d,memory:data.memoryUsage[i]?.value||0}))}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[0,100]}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="value" stroke={C.cyan} fill={C.cyan} fillOpacity={0.15} strokeWidth={2} name="CPU %"/><Area type="monotone" dataKey="memory" stroke={C.purple} fill={C.purple} fillOpacity={0.15} strokeWidth={2} name="Memory %"/></AreaChart></ResponsiveContainer></CP>
          </div>
          <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}><PH title="Endpoint Performance" subtitle="Top endpoints by request volume"/><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Endpoint","Status","RPM","p50 (ms)","p95 (ms)","p99 (ms)"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 12px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{data.endpoints.map((ep,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.panelBorder}22`}}><td style={{padding:"10px 12px",color:C.cyan}}>{ep.endpoint}</td><td style={{padding:"10px 12px"}}><SB status={ep.p95>400?"warning":ep.p99>1000?"critical":"healthy"}/></td><td style={{padding:"10px 12px"}}>{ep.rpm.toLocaleString()}</td><td style={{padding:"10px 12px",color:ep.p50>100?C.orange:C.green}}>{ep.p50}</td><td style={{padding:"10px 12px",color:ep.p95>300?C.orange:C.green}}>{ep.p95}</td><td style={{padding:"10px 12px",color:ep.p99>800?C.red:ep.p99>400?C.orange:C.green}}>{ep.p99}</td></tr>))}</tbody></table></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <CP title="Database Connections" subtitle="Active pool connections" height={200}><ResponsiveContainer><BarChart data={data.dbConnections.slice(-20)}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={3}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Bar dataKey="value" fill={C.purple} radius={[2,2,0,0]} name="Connections"/></BarChart></ResponsiveContainer></CP>
            <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px",height:200}}><PH title="PHP-FPM Workers" subtitle="Process manager status"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:8}}><div style={{background:C.bg,borderRadius:4,padding:12}}><div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ACTIVE WORKERS</div><div style={{fontSize:28,fontWeight:700,color:C.green,fontFamily:"monospace"}}>{data.activeWorkers}</div><div style={{fontSize:10,color:C.textMuted}}>of 32 max</div><div style={{marginTop:6,height:4,background:C.panelBorder,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(data.activeWorkers/32)*100}%`,background:C.green,borderRadius:2}}/></div></div><div style={{background:C.bg,borderRadius:4,padding:12}}><div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>QUEUE DEPTH</div><div style={{fontSize:28,fontWeight:700,color:data.queueDepth>15?C.orange:C.blue,fontFamily:"monospace"}}>{data.queueDepth}</div><div style={{fontSize:10,color:C.textMuted}}>pending requests</div><div style={{marginTop:6,height:4,background:C.panelBorder,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min((data.queueDepth/50)*100,100)}%`,background:data.queueDepth>15?C.orange:C.blue,borderRadius:2}}/></div></div></div></div>
          </div>
        </>)}

        {/* ── LOGS ── */}
        {(activeTab==="logs"||activeTab==="all")&&(<>
          {activeTab==="all"&&<div style={{borderTop:`1px solid ${C.panelBorder}`,margin:"8px 0",paddingTop:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>📋 Logs & Error Tracking</div></div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>{LL.map(level=>(<div key={level} onClick={()=>setLogFilter(logFilter===level?"ALL":level)} style={{background:logFilter===level?`${LOG_C[level]}15`:C.panel,border:`1px solid ${logFilter===level?LOG_C[level]+"66":C.panelBorder}`,borderRadius:4,padding:"10px 14px",cursor:"pointer",transition:"all 0.2s"}}><div style={{fontSize:10,color:LOG_C[level],fontWeight:600,fontFamily:"monospace",marginBottom:2}}>{level}</div><div style={{fontSize:24,fontWeight:700,color:LOG_C[level],fontFamily:"monospace"}}>{logCounts[level]||0}</div><div style={{fontSize:10,color:C.textMuted}}>{((logCounts[level]||0)/totalLogs*100).toFixed(1)}%</div></div>))}</div>
          <CP title="Log Volume Over Time" subtitle="Lines per minute by severity" height={220}><ResponsiveContainer><AreaChart data={data.logVolume}><CartesianGrid strokeDasharray="3 3" stroke={C.gridLine}/><XAxis dataKey="time" tick={{fontSize:10,fill:C.textMuted}} interval={9}/><YAxis tick={{fontSize:10,fill:C.textMuted}}/><Tooltip content={<CT/>}/><Area type="monotone" dataKey="INFO" stackId="1" stroke={LOG_C.INFO} fill={LOG_C.INFO} fillOpacity={0.3}/><Area type="monotone" dataKey="DEBUG" stackId="1" stroke={LOG_C.DEBUG} fill={LOG_C.DEBUG} fillOpacity={0.3}/><Area type="monotone" dataKey="WARN" stackId="1" stroke={LOG_C.WARN} fill={LOG_C.WARN} fillOpacity={0.4}/><Area type="monotone" dataKey="ERROR" stackId="1" stroke={LOG_C.ERROR} fill={LOG_C.ERROR} fillOpacity={0.5}/><Area type="monotone" dataKey="CRITICAL" stackId="1" stroke={LOG_C.CRITICAL} fill={LOG_C.CRITICAL} fillOpacity={0.6}/></AreaChart></ResponsiveContainer></CP>
          <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 12px",height:420}}>
            <PH title="Live Log Stream" subtitle={`${logs.length} entries • ${logFilter==="ALL"?"all levels":logFilter}`} extra={<div style={{display:"flex",gap:6,alignItems:"center"}}><input type="text" placeholder="🔍 Filter logs..." value={logSearch} onChange={e=>setLogSearch(e.target.value)} style={{background:C.bg,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"4px 10px",fontSize:11,color:C.text,fontFamily:"monospace",width:180,outline:"none"}}/><div style={{display:"flex",border:`1px solid ${C.panelBorder}`,borderRadius:4,overflow:"hidden"}}>{["ALL",...LL].map(l=>(<button key={l} onClick={()=>setLogFilter(l)} style={{background:logFilter===l?(l==="ALL"?C.blue+"33":LOG_C[l]+"33"):"transparent",color:logFilter===l?(l==="ALL"?C.blue:LOG_C[l]):C.textMuted,border:"none",padding:"3px 7px",fontSize:9,cursor:"pointer",fontFamily:"monospace",borderRight:`1px solid ${C.panelBorder}`}}>{l}</button>))}</div></div>}/>
            <div style={{height:340}}><LiveLogStream logs={logs} filter={logFilter} searchTerm={logSearch}/></div>
          </div>
          <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}><PH title="Error Groups" subtitle="Click to expand stack trace"/><table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}><thead><tr style={{borderBottom:`1px solid ${C.panelBorder}`}}>{["Error","Count","Source","First","Last","Trend"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 10px",color:C.textMuted,fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{data.errorGroups.map((eg,i)=>(<tr key={i} onClick={()=>setExpandedLog(expandedLog===i?null:i)} style={{borderBottom:`1px solid ${C.panelBorder}22`,cursor:"pointer",background:expandedLog===i?`${C.blue}0a`:"transparent"}} onMouseEnter={e=>{if(expandedLog!==i)e.currentTarget.style.background=`${C.blue}06`}} onMouseLeave={e=>{if(expandedLog!==i)e.currentTarget.style.background="transparent"}}><td style={{padding:"10px",color:C.orange,maxWidth:300,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{eg.error}</td><td style={{padding:"10px",color:eg.count>500?C.red:eg.count>100?C.orange:C.text,fontWeight:700}}>{eg.count.toLocaleString()}</td><td style={{padding:"10px",color:C.cyan}}>{eg.source}</td><td style={{padding:"10px",color:C.textMuted}}>{eg.firstSeen}</td><td style={{padding:"10px",color:C.text}}>{eg.lastSeen}</td><td style={{padding:"10px"}}><TI trend={eg.trend}/></td></tr>))}</tbody></table>
          {expandedLog!==null&&(<div style={{animation:"slideIn 0.2s ease",margin:"8px 0",padding:14,background:C.bg,borderRadius:6,border:`1px solid ${C.panelBorder}`}}><div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:10}}>{data.errorGroups[expandedLog].error}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,fontSize:10}}><div><span style={{color:C.textMuted}}>Trace: </span><span style={{color:C.cyan}}>trace-a8f3c2d91e47</span></div><div><span style={{color:C.textMuted}}>Span: </span><span style={{color:C.cyan}}>span-7d2b4e</span></div><div><span style={{color:C.textMuted}}>Request: </span><span style={{color:C.cyan}}>req-f9281a</span></div></div><div style={{marginTop:10,padding:10,background:"#0d1017",borderRadius:4,fontSize:10,lineHeight:1.8,color:C.red,whiteSpace:"pre-wrap"}}>{`Stack Trace:\n  #0 /app/vendor/laravel/framework/src/Database/Connection.php(742): PDO->prepare()\n  #1 /app/vendor/laravel/framework/src/Database/Connection.php(540): reconnectIfMissing()\n  #2 /app/Http/Controllers/UserController.php(128): index()\n  #3 /app/vendor/laravel/framework/src/Routing/Controller.php(54): callAction()\n  #4 /app/vendor/laravel/framework/src/Routing/Router.php(723): runRoute()\n  #5 /app/public/index.php(55): Kernel->handle()`}</div></div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}><PH title="Logs by Source" subtitle="Distribution across services"/><div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>{LS.map(src=>{const cnt=logs.filter(l=>l.source===src).length;const pct=totalLogs?(cnt/totalLogs*100):0;return(<div key={src} style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:10,color:C.cyan,fontFamily:"monospace",minWidth:90}}>{src}</span><div style={{flex:1,height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:C.blue,borderRadius:3,transition:"width 0.5s"}}/></div><span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace",minWidth:32,textAlign:"right"}}>{cnt}</span></div>);})}</div></div>
            <div style={{background:C.panel,border:`1px solid ${C.panelBorder}`,borderRadius:4,padding:"14px 16px"}}><PH title="Recent Critical & Error" subtitle="Last 10 high-severity"/><div style={{overflowY:"auto",maxHeight:170,fontSize:10,fontFamily:"monospace"}}>{logs.filter(l=>l.level==="ERROR"||l.level==="CRITICAL").slice(-10).reverse().map((l,i)=>(<div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${C.panelBorder}22`,display:"flex",gap:6,alignItems:"flex-start"}}><LB level={l.level}/><span style={{color:C.textMuted,whiteSpace:"nowrap"}}>{new Date(l.timestamp).toLocaleTimeString("en-US",{hour12:false})}</span><span style={{color:l.level==="CRITICAL"?C.red:C.orange,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.message}</span></div>))}</div></div>
          </div>
        </>)}

        {/* ── AWS ── */}
        {(activeTab==="aws"||activeTab==="all")&&(<>
          {activeTab==="all"&&<div style={{borderTop:`1px solid ${C.panelBorder}`,margin:"8px 0",paddingTop:16}}><div style={{fontSize:14,fontWeight:700,marginBottom:8}}>☁️ AWS Infrastructure</div></div>}
          <AwsTab eks={data.eks} rds={data.rds} sqs={data.sqs} s3={data.s3}/>
        </>)}

        <div style={{textAlign:"center",padding:"8px 0 16px",fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>
          Demo Dashboard • Metrics 5s • Logs 1.5s • Docker 🐳
        </div>
      </div>
    </div>
  );
}
