/* Obsidian loads a plugin's entry point as CommonJS, so `require` is the correct
   module syntax here — this plugin ships main.js directly and has no build step.
   The directive below states exactly that to the linter; without it the official
   rules (no-require-imports, no-undef) flag a legitimate pattern.
   It must be a single comment immediately above the call: two stacked
   disable-next-line comments each attach to the *next line*, so the first one
   would end up silencing nothing but the second comment. */
/* eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Obsidian loads a plugin's entry point as CommonJS, so `require` here is the loader's own parameter rather than a browser global or an ES import. */
const { Plugin, ItemView, Notice, PluginSettingTab, Setting, SuggestModal, normalizePath, TFile } = require("obsidian");
const VIEW_TYPE = "weekly-planner-view";

const DEFAULT_SETTINGS = {
  lang: "en",              // UI language: en | zh
  defaultPalette: "macaron",
  archiveFolder: "Weekly Planner",
  filenameTemplate: "{{start}}",
  dateFormat: "YYYY-MM-DD",
  includeCompleted: true,
  autoArchive: false,
  showDailyChart: true,
  weekStartsOn: 1,         // 1 = Monday, 0 = Sunday
  /* Automatic backup. data.json lives INSIDE the plugin folder, and Obsidian
     wipes that folder when it rolls back an externally-added enable entry — so
     the copies go to a vault folder instead, where they survive. */
  backupEnabled: true,
  backupFolder: "_weekly-planner-backup",
  backupEveryMin: 5,       // at most one automatic copy per N minutes (0 = every change)
  backupKeep: 30           // how many copies to retain
};

function mergeSettings(data){
  const s = Object.assign({}, DEFAULT_SETTINGS, (data && data.settings) || {});
  return s;
}

/* Palette id -> display name, mirrored from PALETTES for use at module scope. */
const PALETTE_NAMES = {};

const TEMPLATE = `<div class="wp-app">
<div class="app">

  <!-- ================= SIDEBAR ================= -->
  <aside class="sidebar">

    <section class="card">
      <h3 data-i18n="weekOf">Week of / Month</h3>
      <div class="cal-head">
        <b id="calTitle">—</b>
        <div class="cal-nav">
          <button class="mini" id="calPrev">‹</button>
          <button class="mini" id="calNext">›</button>
        </div>
      </div>
      <div class="cal-grid" id="calGrid"></div>
    </section>

    <section class="card">
      <h3 data-i18n="priorities">Weekly Priorities</h3>
      <div id="priorities"></div>
      <div class="addline">
        <input type="text" id="priInput" data-i18n-ph="addPriority" placeholder="add priority…">
        <button class="mini" id="priAdd">＋</button>
      </div>
    </section>

    <section class="card">
      <h3 data-i18n="weekTasks">Weekly Task List</h3>
      <div id="weekTasks"></div>
      <div class="addline">
        <input type="text" id="wtInput" data-i18n-ph="addTask" placeholder="add task…">
        <button class="mini" id="wtAdd">＋</button>
      </div>
    </section>

    <section class="card">
      <h3 data-i18n="habits">Habits</h3>
      <div class="hab-head">
        <span></span>
        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
      </div>
      <div id="habits"></div>
      <div class="addline">
        <input type="text" id="habInput" data-i18n-ph="addHabit" placeholder="add habit…">
        <button class="mini" id="habAdd">＋</button>
      </div>
    </section>

    <section class="card">
      <h3 data-i18n="catMgr">Task Category Manager</h3>
      <div class="pal-row">
        <span style="font-size:11px;color:var(--ink2)" data-i18n="choosePalette">Choose Color Palette:</span>
        <select id="palSel"></select>
      </div>
      <div class="swatches" id="swatches"></div>
      <div id="catList"></div>
      <div class="addline">
        <input type="text" id="catInput" data-i18n-ph="addCat" placeholder="add category…">
        <button class="mini" id="catAdd">＋</button>
      </div>
    </section>

    <section class="card">
      <h3 data-i18n="data">Data</h3>
      <div class="datarow">
        <button id="btnExport" data-i18n="exportJson">Export JSON</button>
        <button id="btnImport" data-i18n="importJson">Import JSON</button>
        <button id="btnArchiveMd" data-i18n="archiveMd">Export current week as Markdown</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
      </div>
    </section>

  </aside>

  <!-- ================= MAIN ================= -->
  <main class="main">
    <header class="head">
      <h1 data-i18n="mainTitle">Weekly Planner | Drag &amp; Drop</h1>
      <div class="sub" data-i18n="sub">Set date range</div>
      <div class="toolbar">
        <label data-i18n="start">Start:</label><input type="date" id="dateStart">
        <label data-i18n="end">End:</label><input type="date" id="dateEnd">
        <button id="btnApply" data-i18n="apply">Apply</button>
        <select id="periodSel"></select>
        <!-- week jump: pick any week relative to today and go straight there -->
        <button id="btnPrevWeek" class="mini wk" data-i18n-title="jumpBack" title="Previous week">‹</button>
        <select id="weekJump" data-i18n-title="jumpWeek" title="Jump to week"></select>
        <button id="btnNextWeek" class="mini wk" data-i18n-title="jumpFwd" title="Next week">›</button>
        <div class="spacer"></div>
        <select id="langSel"></select>
        <button id="btnArchive" data-i18n="archive">Archive Week</button>
        <button id="btnNew" data-i18n="newPeriod">New Period</button>
        <button id="btnClear" data-i18n="clearCheck">Clear Check</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat"><div class="lb" data-i18n="totalTasks">Total Tasks</div><div class="vl" id="stTotal">0</div></div>
      <div class="stat"><div class="lb" data-i18n="completed">Completed</div><div class="vl" id="stDone">0</div></div>
      <div class="stat"><div class="lb" data-i18n="plannedHours">Planned Hours</div><div class="vl" id="stPlan">0.0</div></div>
      <div class="stat"><div class="lb" data-i18n="actualHours">Actual Hours</div><div class="vl" id="stAct">0.0</div></div>
    </div>

    <div class="pills" id="catPills"></div>

    <div class="days" id="days"></div>
  </main>
</div>
</div>`;

/* Every markup write in this file goes through here. Each caller passes either a
   static template or markup whose dynamic parts have all been through esc().
   Funnelling the DOM write into one module-scope function is what keeps that
   invariant reviewable — and it has to be module scope, because the two calls in
   WeeklyPlannerView sit outside initPlanner(). The rule below cannot see through
   esc() on its own, so the exception is granted once, here, instead of at
   twenty-two separate call sites.
   @microsoft/sdl/no-inner-html deliberately stays on: eslint-comments forbids
   suppressing that rule, and its warning is a fair reminder at this one line. */
function setHTML(el, html){
  // eslint-disable-next-line no-unsanitized/property -- markup comes from static templates; every interpolation has been through esc()
  if(el) el.innerHTML = html;
}

function initPlanner(root, plugin){
  "use strict";
  const $ = id => root.querySelector("#"+id);
  const $$ = sel => root.querySelectorAll(sel);
  const note = m => new Notice(m);

/* =========================================================
   Weekly Planner — Obsidian plugin view
   Data persisted via plugin.loadData / saveData
========================================================= */
const DAY_KEYS=["mon","tue","wed","thu","fri","sat","sun"];
const DAY_NAMES=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const STORE_KEY="wb_weekly_planner_v1";

const PALETTES={
  macaron:{name:"马卡龙色系 Macaron",colors:["#f6c6d3","#f8cfb4","#f4e3a7","#cde8c4","#c6e2ee","#d8c9e8","#f2c4c4","#cde4dd"],
    vars:{"--bg":"#f7efe1","--card":"#fffdf8","--card2":"#fdf6ea","--line":"#eadfc9","--ink":"#4a443a","--ink2":"#8a8171","--btn":"#f0e5cf","--btn-line":"#e2d3b6","--btn-hover":"#e9dcbd","--input-bg":"#fffefb","--focus-line":"#d9c398","--hover-wash":"#f7efdd","--inrange":"#f3e3c0","--accent":"#f2c14e","--accent-ink":"#6b5510","--accent-deep":"#d9a92e","--chk-line":"#c9b890","--scroll":"#ddceb2","--scroll2":"#e8dbc2","--muted3":"#7c7361","--muted4":"#c0b294","--soft":"#eee3cb","--soft-hover":"#e7d9ba","--soft2":"#efe6cf","--soft3":"#faf4e6","--soft-ink":"#8a7c5f","--note-line":"#e8dcc4","--shadow":"0 2px 10px rgba(160,125,70,.10)"}},
  morandi:{name:"莫兰迪色系 Morandi",colors:["#d8c7c2","#cfc2ab","#c2c9b4","#a9b6c4","#b7aec6","#c9b8a6","#c4a9a9","#a8bdb5"],
    vars:{"--bg":"#eae7e1","--card":"#f6f4f0","--card2":"#efece6","--line":"#d5cfc5","--ink":"#4b4741","--ink2":"#8b857a","--btn":"#e0dbd2","--btn-line":"#cbc4b8","--btn-hover":"#d5cec1","--input-bg":"#fcfbf8","--focus-line":"#c2b8a8","--hover-wash":"#ece7de","--inrange":"#ded4c4","--accent":"#b0987f","--accent-ink":"#3f3226","--accent-deep":"#97795d","--chk-line":"#b8ad9c","--scroll":"#cfc7ba","--scroll2":"#ded7cb","--muted3":"#7d766b","--muted4":"#b3ab9d","--soft":"#e3ddd2","--soft-hover":"#d8d0c2","--soft2":"#e6e0d6","--soft3":"#f1ede5","--soft-ink":"#7d766b","--note-line":"#d8d0c2","--shadow":"0 2px 10px rgba(90,80,60,.10)"}},
  monetish:{name:"莫奈花园色系 Monetish",colors:["#a9c0dc","#b8ccdf","#9db8a8","#c2b2d2","#d5c3da","#8fb0c8","#c7d2e4","#adc4ba"],
    vars:{"--bg":"#e9eef2","--card":"#f7fafc","--card2":"#edf2f6","--line":"#ccd8e0","--ink":"#3f4750","--ink2":"#7f8a94","--btn":"#dfe8ee","--btn-line":"#c3d2dc","--btn-hover":"#cfdde8","--input-bg":"#fcfdfe","--focus-line":"#a9bfd2","--hover-wash":"#e4ecf2","--inrange":"#d3e0ec","--accent":"#7d9cc0","--accent-ink":"#1f2f45","--accent-deep":"#6386ad","--chk-line":"#9fb2c2","--scroll":"#c2d2de","--scroll2":"#d4e0ea","--muted3":"#74808c","--muted4":"#a8b4bf","--soft":"#dbe6ee","--soft-hover":"#c9d9e5","--soft2":"#dfe9f0","--soft3":"#eef4f8","--soft-ink":"#74808c","--note-line":"#cfdce6","--shadow":"0 2px 10px rgba(60,90,120,.10)"}},
  memphis:{name:"孟菲斯色系 Memphis",colors:["#ff6b6b","#ffa94d","#ffd43b","#69db7c","#4dabf7","#9775fa","#f783ac","#38d9a9"],
    vars:{"--bg":"#fff3e4","--card":"#fffdf7","--card2":"#fff4e2","--line":"#f0ddc4","--ink":"#463f3a","--ink2":"#94867a","--btn":"#ffe6c7","--btn-line":"#f2d0a4","--btn-hover":"#f8d9a8","--input-bg":"#fffef9","--focus-line":"#e6c193","--hover-wash":"#ffefd8","--inrange":"#ffe0b8","--accent":"#ff7a59","--accent-ink":"#5f1d0c","--accent-deep":"#e85f3e","--chk-line":"#dcb98c","--scroll":"#f0d4a8","--scroll2":"#f6e2c4","--muted3":"#8d7f70","--muted4":"#c4ae95","--soft":"#ffe3bd","--soft-hover":"#ffd79e","--soft2":"#ffe8c2","--soft3":"#fff6e8","--soft-ink":"#8d7f70","--note-line":"#f0dcb8","--shadow":"0 2px 10px rgba(190,110,60,.12)"}},
  rococo:{name:"洛可可色系 Rococo",colors:["#e5b3c8","#efd0dd","#d79ab4","#e8d3ae","#c9a3c8","#f2e2e6","#d8b1ad","#e2c0a6"],
    vars:{"--bg":"#f5e6ea","--card":"#fdf6f8","--card2":"#f8eef1","--line":"#e6cfd7","--ink":"#4f4348","--ink2":"#95838b","--btn":"#f2dde4","--btn-line":"#e0c2cd","--btn-hover":"#ead0d9","--input-bg":"#fefbfc","--focus-line":"#d4b2c0","--hover-wash":"#f7e6ec","--inrange":"#f2d8e0","--accent":"#d4899f","--accent-ink":"#5c2434","--accent-deep":"#bd6f88","--chk-line":"#d0b0bd","--scroll":"#e2c8d2","--scroll2":"#edd8de","--muted3":"#8c7a82","--muted4":"#c2aab2","--soft":"#f4dee6","--soft-hover":"#eccfda","--soft2":"#f5e2e9","--soft3":"#faf0f3","--soft-ink":"#8c7a82","--note-line":"#e9d2da","--shadow":"0 2px 10px rgba(150,80,105,.10)"}},
  dunhuang:{name:"敦煌色系 Dunhuang",colors:["#c0603a","#d69a4e","#a9b585","#7d9c8a","#8a6f56","#c9a066","#b85c4e","#6f8a78"],
    vars:{"--bg":"#ede1cb","--card":"#f9f2e2","--card2":"#f1e6cf","--line":"#dbc9a8","--ink":"#4c4234","--ink2":"#8d7f6a","--btn":"#e8d9b8","--btn-line":"#d4c096","--btn-hover":"#ddcb9f","--input-bg":"#fdfaf2","--focus-line":"#c4ac7e","--hover-wash":"#f0e6d0","--inrange":"#e2d2ae","--accent":"#c0603a","--accent-ink":"#fbf0dd","--accent-deep":"#a34e2c","--chk-line":"#bda476","--scroll":"#d0bd97","--scroll2":"#e0d2b2","--muted3":"#7c6f5b","--muted4":"#b8a888","--soft":"#e6d6b2","--soft-hover":"#dbc9a0","--soft2":"#ead9b6","--soft3":"#f5ecd8","--soft-ink":"#7c6f5b","--note-line":"#ddceac","--shadow":"0 2px 10px rgba(120,80,40,.12)"}}
};
const DEFAULT_CATS=["Study","Sport","Reading","Entertainment","Family Activity","Hobby"];

/* Palette names are needed by the settings tab (module scope), so publish them there too. */
Object.keys(PALETTES).forEach(k=>{ PALETTE_NAMES[k]=PALETTES[k].name; });

/* ---------------- i18n ---------------- */
const I18N={
  en:{
    appTitle:"Weekly Planner | Drag & Drop",
    weekOf:"Week of / Month",
    priorities:"Weekly Priorities",
    weekTasks:"Weekly Task List",
    habits:"Habits",
    catMgr:"Task Category Manager",
    data:"Data",
    addPriority:"add priority…",
    addTask:"add task…",
    addHabit:"add habit…",
    addCat:"add category…",
    choosePalette:"Choose Color Palette:",
    exportJson:"Export JSON",
    importJson:"Import JSON",
    mainTitle:"Weekly Planner | Drag & Drop",
    sub:"Set date range",
    start:"Start:",
    end:"End:",
    apply:"Apply",
    archive:"Archive Week",
    newPeriod:"New Period",
    clearCheck:"Clear Check",
    noPriorities:"no priorities yet",
    noTasks:"no tasks yet",
    noHabits:"no habits yet",
    dragTasks:"drag tasks here",
    dailyChart:"Daily Chart",
    dailyNote:"Daily Note / Summary",
    noData:"no data",
    totalTasks:"Total Tasks",
    completed:"Completed",
    plannedHours:"Planned Hours",
    actualHours:"Actual Hours",
    planned:"Planned:",
    actual:"Actual:",
    addNote:"add handwritten note",
    write:"write…",
    alertRange:"Please select start and end dates",
    alertOrder:"End date cannot be earlier than start date",
    alertOneCat:"Keep at least one category",
    alertArchived:"Week archived (switch back anytime from the dropdown)",
    confirmClear:"Uncheck all completed items in the current period?",
    importOk:"Imported successfully",
    importBad:"Invalid file format",
    archiveMd:"Export current week as Markdown",
    archiveNone:"Nothing to export for this period",
    archiveDone:"Archived to ",
    archiveFail:"Failed to write archive file: ",
    jumpWeek:"Jump to week",
    thisWeek:"This week",
    lastWeek:"Last week",
    nextWeek:"Next week",
    weeksAgo:"weeks ago",
    weeksAhead:"weeks ahead",
    jumpBack:"Previous week",
    jumpFwd:"Next week"
  },
  zh:{
    appTitle:"周计划 | 拖拽看板",
    weekOf:"所属周 / 月份",
    priorities:"本周优先级",
    weekTasks:"本周任务清单",
    habits:"习惯打卡",
    catMgr:"任务分类管理",
    data:"数据",
    addPriority:"添加优先级…",
    addTask:"添加任务…",
    addHabit:"添加习惯…",
    addCat:"添加分类…",
    choosePalette:"选择配色方案：",
    exportJson:"导出 JSON",
    importJson:"导入 JSON",
    mainTitle:"周计划 | 拖拽看板",
    sub:"设置日期范围",
    start:"开始：",
    end:"结束：",
    apply:"应用",
    archive:"归档本周",
    newPeriod:"新建周期",
    clearCheck:"清除勾选",
    noPriorities:"暂无优先级",
    noTasks:"暂无任务",
    noHabits:"暂无习惯",
    dragTasks:"拖拽任务到此",
    dailyChart:"每日图表",
    dailyNote:"每日记录 / 小结",
    noData:"暂无数据",
    totalTasks:"任务总数",
    completed:"已完成",
    plannedHours:"计划时长",
    actualHours:"实际时长",
    planned:"计划：",
    actual:"实际：",
    addNote:"添加手写批注",
    write:"书写…",
    alertRange:"请选择起止日期",
    alertOrder:"结束日期不能早于开始日期",
    alertOneCat:"至少保留一个分类",
    alertArchived:"已归档本周（可随时从下拉框切回查看）",
    confirmClear:"取消当前周期内所有已勾选项？",
    importOk:"导入成功",
    importBad:"文件格式不正确",
    archiveMd:"导出本周为 Markdown",
    archiveNone:"本周期暂无可导出内容",
    archiveDone:"已归档至 ",
    archiveFail:"写入归档文件失败：",
    jumpWeek:"跳转到周次",
    thisWeek:"本周",
    lastWeek:"上一周",
    nextWeek:"下一周",
    weeksAgo:"周前",
    weeksAhead:"周后",
    jumpBack:"上一周",
    jumpFwd:"下一周"
  }
};function t(k){return (I18N[db.lang]||I18N.en)[k]||k;}

/* ---------------- state ---------------- */
function mondayOf(d){
  const x=new Date(d);const day=(x.getDay()+6)%7;
  x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x;
}
function fmtDate(d){
  const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}
function parseDate(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}

let db=plugin.data;
if(!db.lang)db.lang="en";
const SET = plugin.settings;

function seed(){
  const start=mondayOf(new Date());
  const end=new Date(start);end.setDate(end.getDate()+6);
  const id=fmtDate(start);
  return{
    palette:"macaron",
    categories:DEFAULT_CATS.slice(),
    habits:[],
    periods:{},
    currentId:id,
    counter:1,
    lang:"en"
  };
}
function blankPeriod(start,end){
  return{start:fmtDate(start),end:fmtDate(end),archived:false,
    days:DAY_KEYS.map(()=>[]),notes:DAY_KEYS.map(()=>""),
    priorities:[],weekTasks:[]};
}
function ensurePeriod(){
  if(!db.periods)db.periods={};
  /* currentId can arrive empty or unparsable: the seed file used to recover a
     wiped data.json carries currentId:"", and a hand-edited file may carry
     anything. Left alone, parseDate() yields an Invalid Date and the period key
     becomes "NaN-NaN-NaN" — visible right in the UI. Normalising here (rather
     than in onload) covers every path that renders: fresh load, import, restore. */
  if(!db.currentId||isNaN(parseDate(db.currentId).getTime())){
    db.currentId=fmtDate(mondayOf(new Date()));
  }
  if(!db.periods[db.currentId]){
    const p=blankPeriod(parseDate(db.currentId),addDays(parseDate(db.currentId),6));
    db.periods[db.currentId]=p;
  }
  const p=db.periods[db.currentId];
  return p;
}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function periodDates(p){
  const s=parseDate(p.start);return DAY_KEYS.map((_,i)=>fmtDate(addDays(s,i)));
}
/* `plugin.data` is the plugin's own handle on the same object, so keep it
   pointing at the live state (an import/restore may swap the object out) — the
   backup engine reads it from outside this closure. */
function save(){plugin.data=db;plugin.saveData(db);plugin.scheduleBackup();}

function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function curPalette(){return PALETTES[db.palette]||PALETTES.macaron;}
function catColor(idx){const cs=curPalette().colors;return cs[idx%cs.length];}
function applyTheme(){
  const vars=curPalette().vars||PALETTES.macaron.vars;
  const st=root.style;
  Object.keys(vars).forEach(k=>st.setProperty(k,vars[k]));
}
function newId(){return "t"+(db.counter++);}

/* ---------------- calendar ---------------- */
let calView=null; // {y,m}
function renderCalendar(){
  const p=ensurePeriod();
  const start=parseDate(p.start),end=parseDate(p.end);
  const todayS=fmtDate(new Date());
  if(!calView){const s=parseDate(p.start);calView={y:s.getFullYear(),m:s.getMonth()};}
  const {y,m}=calView;
  $( "calTitle" ).textContent=(m+1)+" / "+y;
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7; // Monday first
  const dim=new Date(y,m+1,0).getDate();
  let html="";
  ["M","T","W","T","F","S","S"].forEach(d=>html+='<span class="dow">'+d+"</span>");
  for(let i=0;i<offset;i++)html+='<span class="d blank"></span>';
  for(let d=1;d<=dim;d++){
    const ds=y+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const inr=ds>=p.start&&ds<=p.end;
    const td=ds===todayS;
    html+='<span class="d'+(inr?" inrange":"")+(td?" today":"")+'">'+d+"</span>";
  }
  setHTML($( "calGrid" ), html);
}
$( "calPrev" ).onclick=()=>{calView.m--;if(calView.m<0){calView.m=11;calView.y--;}renderCalendar();};
$( "calNext" ).onclick=()=>{calView.m++;if(calView.m>11){calView.m=0;calView.y++;}renderCalendar();};

/* ---------------- priorities ---------------- */
function renderPriorities(){
  const p=ensurePeriod();
  const box=$( "priorities" );
  if(!p.priorities.length){setHTML(box, '<div class="emptyhint">'+t("noPriorities")+'</div>');return;}
  setHTML(box, p.priorities.map((it,i)=>
    '<div class="rowitem">'+
    '<span class="chk'+(it.done?" on":"")+'" data-pri="'+i+'"></span>'+
    '<input class="txt" data-pritext="'+i+'" value="'+esc(it.text)+'">'+
    '<span class="del" data-pridel="'+i+'">×</span></div>'
  ).join(""));
}
$( "priorities" ).addEventListener("click",e=>{
  const p=ensurePeriod();
  const c=e.target.closest("[data-pri]"),d=e.target.closest("[data-pridel]");
  if(c){p.priorities[+c.dataset.pri].done=!p.priorities[+c.dataset.pri].done;save();renderPriorities();}
  if(d){p.priorities.splice(+d.dataset.pridel,1);save();renderPriorities();}
});
$( "priorities" ).addEventListener("change",e=>{
  const t=e.target.closest("[data-pritext]");
  if(t){ensurePeriod().priorities[+t.dataset.pritext].text=t.value;save();}
});
$( "priAdd" ).onclick=()=>{
  const v=$( "priInput" ).value.trim();
  if(!v)return;
  ensurePeriod().priorities.push({text:v,done:false});
  $( "priInput" ).value="";save();renderPriorities();
};
$( "priInput" ).addEventListener("keydown",e=>{if(e.key==="Enter")$( "priAdd" ).click();});

/* ---------------- weekly task list ---------------- */
function renderWeekTasks(){
  const p=ensurePeriod();
  const box=$( "weekTasks" );
  if(!p.weekTasks.length){setHTML(box, '<div class="emptyhint">'+t("noTasks")+'</div>');return;}
  setHTML(box, p.weekTasks.map((it,i)=>
    '<div class="rowitem">'+
    '<span class="chk'+(it.done?" on":"")+'" data-wt="'+i+'"></span>'+
    '<input class="txt" data-wttext="'+i+'" value="'+esc(it.text)+'">'+
    '<span class="dot" style="background:'+catColor(it.cat==null?i:it.cat)+'"></span>'+
    '<span class="del" data-wtdel="'+i+'">×</span></div>'
  ).join(""));
}
$( "weekTasks" ).addEventListener("click",e=>{
  const p=ensurePeriod();
  const c=e.target.closest("[data-wt]"),d=e.target.closest("[data-wtdel]");
  if(c){p.weekTasks[+c.dataset.wt].done=!p.weekTasks[+c.dataset.wt].done;save();renderWeekTasks();renderStats();}
  if(d){p.weekTasks.splice(+d.dataset.wtdel,1);save();renderWeekTasks();renderStats();}
});
$( "weekTasks" ).addEventListener("change",e=>{
  const t=e.target.closest("[data-wttext]");
  if(t){ensurePeriod().weekTasks[+t.dataset.wttext].text=t.value;save();}
});
$( "wtAdd" ).onclick=()=>{
  const v=$( "wtInput" ).value.trim();
  if(!v)return;
  ensurePeriod().weekTasks.push({text:v,done:false,cat:null});
  $( "wtInput" ).value="";save();renderWeekTasks();
};
$( "wtInput" ).addEventListener("keydown",e=>{if(e.key==="Enter")$( "wtAdd" ).click();});

/* ---------------- habits ---------------- */
function renderHabits(){
  const box=$( "habits" );
  if(!db.habits.length){setHTML(box, '<div class="emptyhint">'+t("noHabits")+'</div>');return;}
  setHTML(box, db.habits.map((h,hi)=>
    '<div class="hab-row">'+
    '<span class="hcell"><span class="hname" title="'+esc(h.name)+'">'+esc(h.name)+'</span>'+
    '<span class="del" data-habdel="'+hi+'">×</span></span>'+
    h.days.map((v,di)=>'<input type="checkbox" class="sqchk" data-hab="'+hi+'" data-day="'+di+'"'+(v?" checked":"")+">").join("")+
    '</div>'
  ).join(""));
}
$( "habits" ).addEventListener("change",e=>{
  const t=e.target.closest("[data-hab]");
  if(t){db.habits[+t.dataset.hab].days[+t.dataset.day]=t.checked;save();}
});
$( "habits" ).addEventListener("click",e=>{
  const d=e.target.closest("[data-habdel]");
  if(d){db.habits.splice(+d.dataset.habdel,1);save();renderHabits();}
});
$( "habAdd" ).onclick=()=>{
  const v=$( "habInput" ).value.trim();
  if(!v)return;
  db.habits.push({name:v,days:[false,false,false,false,false,false,false]});
  $( "habInput" ).value="";save();renderHabits();
};
$( "habInput" ).addEventListener("keydown",e=>{if(e.key==="Enter")$( "habAdd" ).click();});

/* ---------------- categories ---------------- */
function renderPaletteSel(){
  const sel=$( "palSel" );
  setHTML(sel, Object.keys(PALETTES).map(k=>
    '<option value="'+k+'"'+(k===db.palette?" selected":"")+">"+PALETTES[k].name+"</option>").join(""));
}
$( "palSel" ).addEventListener("change",e=>{
  db.palette=e.target.value;save();renderAll();
});
function renderLangSel(){
  const sel=$( "langSel" );
  setHTML(sel, '<option value="en">English</option><option value="zh">中文</option>');
  sel.value=db.lang||"en";
}
$( "langSel" ).addEventListener("change",e=>{
  db.lang=e.target.value;save();applyLang();
});
function renderSwatches(){
  setHTML($( "swatches" ), curPalette().colors.map(c=>'<i style="background:'+c+'"></i>').join(""));
}
function renderCatList(){
  setHTML($( "catList" ), db.categories.map((c,i)=>
    '<div class="catrow">'+
    '<span class="dot" style="background:'+catColor(i)+'"></span>'+
    '<input data-cat="'+i+'" value="'+esc(c)+'">'+
    '<span class="del" data-catdel="'+i+'">×</span></div>'
  ).join(""));
}
$( "catList" ).addEventListener("change",e=>{
  const t=e.target.closest("[data-cat]");
  if(t){
    const v=t.value.trim();if(v)db.categories[+t.dataset.cat]=v;
    save();renderAll();
  }
});
$( "catList" ).addEventListener("click",e=>{
  const d=e.target.closest("[data-catdel]");
  if(d){
    if(db.categories.length<=1){note(t("alertOneCat"));return;}
    db.categories.splice(+d.dataset.catdel,1);save();renderAll();
  }
});
$( "catAdd" ).onclick=()=>{
  const v=$( "catInput" ).value.trim();
  if(!v)return;
  db.categories.push(v);
  $( "catInput" ).value="";save();renderAll();
};
$( "catInput" ).addEventListener("keydown",e=>{if(e.key==="Enter")$( "catAdd" ).click();});

/* ---------------- toolbar / periods ---------------- */
function renderToolbar(){
  const p=ensurePeriod();
  $( "dateStart" ).value=p.start;
  $( "dateEnd" ).value=p.end;
  const sel=$( "periodSel" );
  const ids=Object.keys(db.periods).sort();
  setHTML(sel, ids.map(id=>{
    const q=db.periods[id];
    return '<option value="'+id+'"'+(id===db.currentId?" selected":"")+">"+
      (q.archived?"🗄 ":"")+id+" ~ "+q.end+"</option>";
  }).join(""));
  renderWeekJump();
}
function switchPeriod(id){db.currentId=id;calView=null;save();renderAll();}
$( "periodSel" ).addEventListener("change",e=>switchPeriod(e.target.value));

/* ---------------- week jump (relative to this week) ----------------
   Lists a window of weeks around today so you can jump straight to any of
   them; picking one creates it if it does not exist yet. Existing, non-empty
   weeks are marked so they stand out from empty ones. */
const WEEK_SPAN=8;   // how many weeks back / forward to offer
function weekOptions(){
  const base=mondayOf(new Date());
  const out=[];
  for(let off=-WEEK_SPAN;off<=WEEK_SPAN;off++){
    const s=new Date(base);
    s.setDate(s.getDate()+off*7);
    const e=new Date(s);e.setDate(e.getDate()+6);
    const id=fmtDate(s);
    let label;
    if(off===0)      label=t("thisWeek");
    else if(off===-1)label=t("lastWeek");
    else if(off===1) label=t("nextWeek");
    else if(off<0)   label=(-off)+" "+t("weeksAgo");
    else             label=off+" "+t("weeksAhead");
    out.push({id,label,off,range:id+" ~ "+fmtDate(e)});
  }
  return out;
}
function renderWeekJump(){
  const wj=$( "weekJump" );
  if(!wj)return;
  const opts=weekOptions();
  setHTML(wj, opts.map(o=>{
    const q=db.periods[o.id];
    // mark weeks that already hold data so empty ones are distinguishable
    let mark="";
    if(q){
      const n=(q.days||[]).reduce((a,d)=>a+((d&&d.length)||0),0);
      if(n>0)mark=" ●";
    }
    const label=o.label+"  ("+o.range+")"+mark;
    return '<option value="'+o.id+'"'+(o.id===db.currentId?" selected":"")+">"+label+"</option>";
  }).join(""));
}
function jumpWeeks(delta){
  const cur=parseDate(db.currentId);
  const s=mondayOf(cur);
  s.setDate(s.getDate()+delta*7);
  const e=new Date(s);e.setDate(e.getDate()+6);
  const id=fmtDate(s);
  if(!db.periods[id])db.periods[id]=blankPeriod(s,e);
  db.currentId=id;calView=null;save();renderAll();
}
if($( "weekJump" )) {
  $( "weekJump" ).addEventListener("change",e=>{
    const id=e.target.value;
    if(db.periods[id]){switchPeriod(id);}
    else{
      const s=parseDate(id);const en=new Date(s);en.setDate(en.getDate()+6);
      db.periods[id]=blankPeriod(s,en);
      db.currentId=id;calView=null;save();renderAll();
    }
  });
}
if($( "btnPrevWeek" ))$( "btnPrevWeek" ).onclick=()=>jumpWeeks(-1);
if($( "btnNextWeek" ))$( "btnNextWeek" ).onclick=()=>jumpWeeks(1);

$( "btnApply" ).onclick=()=>{
  const s=$( "dateStart" ).value;
  const e=$( "dateEnd" ).value;
  if(!s||!e){note(t("alertRange"));return;}
  if(parseDate(e)<parseDate(s)){note(t("alertOrder"));return;}
  if(!db.periods[s]){
    db.periods[s]=blankPeriod(parseDate(s),parseDate(e));
  }else{
    db.periods[s].end=e;
  }
  db.currentId=s;calView=null;save();renderAll();
};
$( "btnNew" ).onclick=()=>{
  const p=ensurePeriod();
  const ns=addDays(parseDate(p.start),7);
  const id=fmtDate(ns);
  if(!db.periods[id]){
    const ne=addDays(ns,6);
    db.periods[id]=blankPeriod(ns,ne);
  }
  db.currentId=id;calView=null;save();renderAll();
};
$( "btnArchive" ).onclick=()=>{
  const p=ensurePeriod();  p.archived=true;save();renderToolbar();
  note(t("alertArchived"));
  if(SET.autoArchive)writeArchive();
};
$( "btnClear" ).onclick=()=>{
  if(!confirm(t("confirmClear")))return;
  const p=ensurePeriod();
  p.days.flat().forEach(t=>t.done=false);
  p.weekTasks.forEach(t=>t.done=false);
  p.priorities.forEach(t=>t.done=false);
  save();renderAll();
};

/* ---------------- stats & pills ---------------- */
function renderStats(){
  const p=ensurePeriod();
  const all=p.days.flat();
  $( "stTotal" ).textContent=all.length;
  $( "stDone" ).textContent=all.filter(t=>t.done).length;
  $( "stPlan" ).textContent=all.reduce((s,t)=>s+(+t.plan||0),0).toFixed(1);
  $( "stAct" ).textContent=all.reduce((s,t)=>s+(+t.act||0),0).toFixed(1);
}
function renderPills(){
  const p=ensurePeriod();
  const all=p.days.flat();
  const box=$( "catPills" );
  setHTML(box, db.categories.map((c,i)=>{
    const ts=all.filter(t=>t.cat===i);
    const plan=ts.reduce((s,t)=>s+(+t.plan||0),0);
    const act=ts.reduce((s,t)=>s+(+t.act||0),0);
    const muted=(plan===0&&act===0)?" muted":"";
    return '<div class="pill'+muted+'" style="background:'+catColor(i)+'">'+
      "<b>"+esc(c)+"</b>"+
      t("planned")+" "+plan.toFixed(1)+"h<br>"+t("actual")+" "+act.toFixed(1)+"h</div>";
  }).join(""));
}

/* ---------------- day columns ---------------- */
let dragId=null;
function renderDays(){
  const p=ensurePeriod();
  const dates=periodDates(p);
  const wrap=$( "days" );
  setHTML(wrap, "");
  DAY_KEYS.forEach((key,i)=>{
    const col=document.createElement("div");
    col.className="daycol";
    col.dataset.day=i;
    setHTML(col, '<div class="dhead"><div class="dn">'+DAY_NAMES[i]+"</div>"+
      '<div class="dd">'+dates[i]+"</div></div>"+
      /* .dbody-scroll wraps ONLY the task list, so the add / chart buttons stay
         outside the scroll area and keep a fixed place under it. */
      '<div class="dbody-scroll"><div class="dbody" data-body="'+i+'"></div></div>'+
      '<button class="addpill" data-add="'+i+'">＋</button>'+
      (SET.showDailyChart===false?"":
        '<button class="chartbtn" data-chart="'+i+'">'+t("dailyChart")+'</button>'+
        '<div class="chartarea" data-area="'+i+'"></div>')+
      '<div class="notewrap"><div class="nl">'+t("dailyNote")+'</div>'+
      '<textarea data-note="'+i+'" placeholder=""></textarea></div>');
    wrap.appendChild(col);
    renderDayTasks(i,col.querySelector("[data-body]"));
    const ta=col.querySelector("[data-note]");
    ta.value=p.notes[i]||"";
    ta.addEventListener("input",()=>{p.notes[i]=ta.value;save();});
  });
}
function renderDayTasks(i,box){
  const p=ensurePeriod();
  const tasks=p.days[i];
  if(!tasks.length){setHTML(box, '<div class="emptyhint">'+t("dragTasks")+'</div>');return;}
  setHTML(box, tasks.map((t,ti)=>{
    const c=catColor(t.cat);
    return '<div class="task'+(t.done?" done":"")+'" draggable="true" data-tid="'+t.id+'" style="background:'+c+'">'+
      '<div class="trow1">'+
      '<span class="chk'+(t.done?" on":"")+'" data-done="'+t.id+'"></span>'+
      '<input class="title" data-title="'+t.id+'" value="'+esc(t.title)+'">'+
      '<span class="del" data-del="'+t.id+'">×</span></div>'+
      '<div class="meta">'+
      '<input type="number" min="0" step="0.5" data-plan="'+t.id+'" value="'+t.plan+'" title="Planned hours">'+
      '<input type="number" min="0" step="0.5" data-act="'+t.id+'" value="'+t.act+'" title="Actual hours">'+
      '<select data-cat="'+t.id+'">'+
      db.categories.map((cn,ci)=>'<option value="'+ci+'"'+(ci===t.cat?" selected":"")+">"+esc(cn)+"</option>").join("")+
      "</select></div></div>";
  }).join(""));
}
/* day events (delegation, bound once) */
const daysWrap=$( "days" );
daysWrap.addEventListener("click",e=>{
  const p=ensurePeriod();
  const add=e.target.closest("[data-add]");
  const ch=e.target.closest("[data-done]");
  const del=e.target.closest("[data-del]");
  const cb=e.target.closest("[data-chart]");
  if(add){
    const i=+add.dataset.add;
    p.days[i].push({id:newId(),title:"New Task",cat:i%db.categories.length,plan:0,act:0,done:false});
    save();renderAll();return;
  }
  if(ch){
    const id=ch.dataset.done;
    p.days.forEach((arr)=>{
      const t=arr.find(x=>x.id===id);
      if(t)t.done=!t.done;
    });
    save();renderAll();return;
  }
  if(del){
    const id=del.dataset.del;
    DAY_KEYS.forEach((_,i)=>{p.days[i]=p.days[i].filter(t=>t.id!==id);});
    save();renderAll();return;
  }
  if(cb){
    const i=+cb.dataset.chart;
    const area=daysWrap.querySelector('[data-area="'+i+'"]');
    if(!area)return;
    const open=area.classList.toggle("open");
    if(open)renderDailyChart(i,area);
  }
});
daysWrap.addEventListener("change",e=>{
  const p=ensurePeriod();
  const tEl=e.target.closest("[data-title]");
  const plEl=e.target.closest("[data-plan]");
  const acEl=e.target.closest("[data-act]");
  const cEl=e.target.closest(".meta [data-cat]");
  const all=p.days.flat();
  if(tEl){const t=all.find(x=>x.id===tEl.dataset.title);if(t){t.title=tEl.value||"Untitled";save();}}
  if(plEl){const t=all.find(x=>x.id===plEl.dataset.plan);if(t){t.plan=Math.max(0,+plEl.value||0);save();renderStats();renderPills();}}
  if(acEl){const t=all.find(x=>x.id===acEl.dataset.act);if(t){t.act=Math.max(0,+acEl.value||0);save();renderStats();renderPills();}}
  if(cEl){const t=all.find(x=>x.id===cEl.dataset.cat);if(t){t.cat=+cEl.value;save();renderAll();}}
});
/* drag & drop */
daysWrap.addEventListener("dragstart",e=>{
  const card=e.target.closest(".task");
  if(!card)return;
  dragId=card.dataset.tid;
  e.dataTransfer.effectAllowed="move";
  try{e.dataTransfer.setData("text/plain",dragId);}catch(err){ /* some platforms reject setData during dragstart; the drag still works without the text payload */ }
});
daysWrap.addEventListener("dragover",e=>{
  const col=e.target.closest(".daycol");
  if(col&&dragId){e.preventDefault();col.classList.add("dragover");}
});
daysWrap.addEventListener("dragleave",e=>{
  const col=e.target.closest(".daycol");
  if(col)col.classList.remove("dragover");
});
daysWrap.addEventListener("drop",e=>{
  const col=e.target.closest(".daycol");
  if(!col||!dragId)return;
  e.preventDefault();
  col.classList.remove("dragover");
  const p=ensurePeriod();
  const to=+col.dataset.day;
  let moved=null,from=-1;
  p.days.forEach((arr,i)=>{
    const idx=arr.findIndex(t=>t.id===dragId);
    if(idx>-1){moved=arr.splice(idx,1)[0];from=i;}
  });
  if(moved){p.days[to].push(moved);}
  dragId=null;save();renderAll();
});
function renderDailyChart(i,area){
  const p=ensurePeriod();
  const tasks=p.days[i];
  const rows=db.categories.map((c,ci)=>{
    const ts=tasks.filter(t=>t.cat===ci);
    const plan=ts.reduce((s,t)=>s+(+t.plan||0),0);
    const act=ts.reduce((s,t)=>s+(+t.act||0),0);
    return{c,ci,plan,act};
  }).filter(r=>r.plan>0||r.act>0);
  if(!rows.length){setHTML(area, '<div class="emptyhint">'+t("noData")+'</div>');return;}
  const max=Math.max(...rows.map(r=>Math.max(r.plan,r.act)),1);
  setHTML(area, rows.map(r=>
    '<div class="crow">'+
    '<span class="cl" title="'+esc(r.c)+'">'+esc(r.c)+"</span>"+
    '<span class="bars">'+
    '<span class="bar plan" style="width:'+Math.max(4,r.plan/max*100)+"%;background:"+catColor(r.ci)+'"></span>'+
    '<span class="bar" style="width:'+Math.max(4,r.act/max*100)+"%;background:"+catColor(r.ci)+'"></span>'+
    "</span>"+
    '<span class="cv">'+r.plan.toFixed(1)+" / "+r.act.toFixed(1)+"h</span></div>"
  ).join(""));
}

/* ---------------- data io ---------------- */
$( "btnExport" ).onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="weekly-planner-backup-"+fmtDate(new Date())+".json";
  a.click();URL.revokeObjectURL(a.href);
};
$( "btnImport" ).onclick=()=>$( "importFile" ).click();
$( "importFile" ).addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d||!d.periods)throw 0;
      db=d;calView=null;save();renderAll();
      note(t("importOk"));
    }catch(err){note(t("importBad"));}
  };
  r.readAsText(f);
  e.target.value="";
});

/* ---------------- markdown archive ---------------- */
function pad2(n){return String(n).padStart(2,"0");}
function fmtByPattern(d,pat){
  const Y=d.getFullYear(),M=pad2(d.getMonth()+1),D=pad2(d.getDate());
  if(pat==="YYYY/MM/DD")return Y+"/"+M+"/"+D;
  if(pat==="YYYY-MM-DD")return Y+"-"+M+"-"+D;
  if(pat==="YYYY年MM月DD日")return Y+"年"+M+"月"+D+"日";
  if(pat==="MM-DD")return M+"-"+D;
  return Y+"-"+M+"-"+D;
}
function buildArchiveMarkdown(p){
  const s=parseDate(p.start),e=parseDate(p.end);
  const fmt=SET.dateFormat||"YYYY-MM-DD";
  const colon=(db.lang==="zh")?"：":": ";
  const lines=[];
  lines.push("# "+t("mainTitle")+" "+fmtByPattern(s,fmt)+" ~ "+fmtByPattern(e,fmt));
  lines.push("");
  const all=p.days.flat();
  const done=all.filter(x=>x.done).length;
  const plan=all.reduce((a,x)=>a+(+x.plan||0),0);
  const act=all.reduce((a,x)=>a+(+x.act||0),0);
  lines.push("- "+t("totalTasks")+colon+all.length);
  lines.push("- "+t("completed")+colon+done);
  lines.push("- "+t("plannedHours")+colon+plan.toFixed(1));
  lines.push("- "+t("actualHours")+colon+act.toFixed(1));
  lines.push("");
  if(p.priorities.length){
    lines.push("## "+t("priorities"));
    p.priorities.forEach(it=>lines.push("- ["+(it.done?"x":" ")+"] "+it.text));
    lines.push("");
  }
  if(p.weekTasks.length){
    lines.push("## "+t("weekTasks"));
    p.weekTasks.forEach(it=>lines.push("- ["+(it.done?"x":" ")+"] "+it.text));
    lines.push("");
  }
  const dates=periodDates(p);
  DAY_KEYS.forEach((k,i)=>{
    const tasks=(p.days[i]||[]).filter(x=>SET.includeCompleted?true:!x.done);
    const note=p.notes[i]||"";
    if(!tasks.length&&!note.trim())return;
    lines.push("## "+DAY_NAMES[i]+" "+dates[i]);
    tasks.forEach(x=>{
      const cn=db.categories[x.cat]!=null?db.categories[x.cat]:"";
      const pl=t("planned").replace(/[:：]\s*$/,"");
      const ac=t("actual").replace(/[:：]\s*$/,"");
      const meta=[cn, pl+" "+(+x.plan||0)+"h", ac+" "+(+x.act||0)+"h"].filter(Boolean).join(" · ");
      lines.push("- ["+(x.done?"x":" ")+"] "+x.title+(meta?" — "+meta:""));
    });
    if(note.trim()){lines.push("");lines.push("> "+note.replace(/\n/g,"\n> "));}
    lines.push("");
  });
  const habitRows=db.habits.filter(h=>h.days.some(Boolean));
  if(habitRows.length){
    lines.push("## "+t("habits"));
    habitRows.forEach(h=>{
      const ce=h.days.map(v=>v?"✓":"·").join(" ");
      lines.push("- "+h.name+colon+ce);
    });
    lines.push("");
  }
  lines.push("---");
  lines.push("*Weekly Planner "+p.start+" ~ "+p.end+"*");
  return lines.join("\n");
}
function archiveFilename(p){
  const s=parseDate(p.start);
  const tpl=SET.filenameTemplate||"{{start}}";
  const name=tpl
    .replace(/\{\{start\}\}/g,p.start)
    .replace(/\{\{end\}\}/g,p.end)
    .replace(/\{\{year\}\}/g,String(s.getFullYear()));
  const safe=name.replace(/[\\/:*?"<>|]/g,"-").trim()||p.start;
  return safe+".md";
}
async function writeArchive(){
  const p=ensurePeriod();
  try{
    let folder=(SET.archiveFolder||"").trim().replace(/\\/g,"/").replace(/^\/+|\/+$/g,"");
    if(folder){
      const abs=normalizePath(folder);
      if(!plugin.app.vault.getAbstractFileByPath(abs)){
        await plugin.app.vault.createFolder(abs);
      }
    }
    const path=normalizePath(folder?folder+"/"+archiveFilename(p):archiveFilename(p));
    const content=buildArchiveMarkdown(p);
    const exist=plugin.app.vault.getAbstractFileByPath(path);
    if(exist && exist instanceof TFile){
      await plugin.app.vault.modify(exist, content);
    }else{
      await plugin.app.vault.create(path, content);
    }
    note(t("archiveDone")+path);
  }catch(err){
    note(t("archiveFail")+(err&&err.message?err.message:err));
  }
}
$( "btnArchiveMd" ).onclick=()=>writeArchive();

/* ---------------- render all ---------------- */
function applyLang(){
  root.lang=(db.lang==="zh")?"zh-CN":"en";
  root.querySelectorAll("[data-i18n]").forEach(el=>{
    const k=el.getAttribute("data-i18n");
    if(I18N[db.lang]&&I18N[db.lang][k]!=null)el.textContent=I18N[db.lang][k];
  });
  root.querySelectorAll("[data-i18n-ph]").forEach(el=>{
    const k=el.getAttribute("data-i18n-ph");
    if(I18N[db.lang]&&I18N[db.lang][k]!=null)el.placeholder=I18N[db.lang][k];
  });
  root.querySelectorAll("[data-i18n-title]").forEach(el=>{
    const k=el.getAttribute("data-i18n-title");
    if(I18N[db.lang]&&I18N[db.lang][k]!=null)el.title=I18N[db.lang][k];
  });
  renderAll();
}
function renderAll(){
  ensurePeriod();
  applyTheme();
  renderToolbar();
  renderCalendar();
  renderPriorities();
  renderWeekTasks();
  renderHabits();
  renderPaletteSel();
  renderSwatches();
  renderLangSel();
  renderCatList();
  renderStats();
  renderPills();
  renderDays();
}
applyLang();
}

class WeeklyPlannerView extends ItemView {
  constructor(leaf, plugin){ super(leaf); this.plugin = plugin; }
  getViewType(){ return VIEW_TYPE; }
  getDisplayText(){ return "Weekly Planner"; }
  getIcon(){ return "calendar-days"; }
  async onOpen(){
    const root = this.contentEl;
    root.empty();
    setHTML(root, TEMPLATE);
    initPlanner(root, this.plugin);
  }
  rerender(){
    const root = this.contentEl;
    root.empty();
    setHTML(root, TEMPLATE);
    initPlanner(root, this.plugin);
  }
  async onClose(){ this.contentEl.empty(); }
}

class WeeklyPlannerPlugin extends Plugin {
  async onload(){
    await this.loadSettings();
    this.data = await this.loadData() || defaultData();
    if(!this.data.lang) this.data.lang = "en";
    if(!this.data.palette) this.data.palette = this.settings.defaultPalette;
    this.registerView(VIEW_TYPE, leaf => new WeeklyPlannerView(leaf, this));
    this.addRibbonIcon("calendar-days", "Weekly Planner", () => this.activateView(false));
    /* Command IDs must NOT repeat the plugin id: Obsidian already prefixes every
       command with it, so "open-weekly-planner" would surface as
       "weekly-planner:open-weekly-planner". The submission requirements call
       this out explicitly ("Don't include the plugin ID in the command ID").
       Command NAMES must not repeat the plugin name either — Obsidian already
       prints the plugin name next to the command in the palette. */
    this.addCommand({
      id: "open",
      name: "Open board",
      callback: () => this.activateView(false)
    });
    this.addCommand({
      id: "open-sidebar",
      name: "Open board in right sidebar",
      callback: () => this.activateView(true)
    });
    this.addCommand({
      id: "backup-now",
      name: "Back up data now",
      callback: () => this.backupNow(true)
    });
    /* First run after a fresh install: leave a copy straight away so the folder
       is not empty until the first edit. Only when there is real content —
       otherwise a rollback-recreated (empty) data.json would be archived as if
       it were worth keeping. */
    if(this.settings.backupEnabled && !this.listBackups().length){
      const p = this.data && this.data.periods;
      const hasTasks = !!p && Object.keys(p).some(k =>
        (((p[k]||{}).days)||[]).some(a => a && a.length));
      if(hasTasks) this.backupNow(false);
    }
    this.addSettingTab(new WeeklyPlannerSettingTab(this.app, this));
  }
  async loadSettings(){
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (raw && raw.settings) || {});
  }
  async saveSettings(){
    const raw = (await this.loadData()) || this.data || defaultData();
    raw.settings = this.settings;
    await this.saveData(raw);
    if(this.data) this.data.settings = this.settings;
    this.refreshViews();
  }
  refreshViews(){
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf=>{
      const v = leaf.view;
      if(v && typeof v.rerender === "function") v.rerender();
    });
  }
  /* ---------------- automatic backup ----------------
     Why the copies live OUTSIDE the plugin folder: Obsidian rewrites
     community-plugins.json from its in-memory list and then deletes the folder of
     any plugin that is not in that list. That takes data.json — every task the
     user ever wrote — with it. Plain JSON copies in a normal vault folder are not
     part of the plugin, so they survive untouched and can be restored from the
     settings tab.
     These methods sit on the plugin instance (not inside the view closure) so the
     settings tab can back up / restore even when no view has been opened yet. */
  backupDir(){
    return String(this.settings.backupFolder||"").trim()
      .replace(/\\/g,"/").replace(/^\/+|\/+$/g,"");
  }
  backupLabel(k){
    const zh = (((this.data&&this.data.lang) || this.settings.lang) === "zh");
    const M = {
      done:     zh ? "已备份至 " : "Backed up to ",
      fail:     zh ? "备份失败：" : "Backup failed: ",
      none:     zh ? "暂无可恢复的备份" : "No backup found",
      bad:      zh ? "恢复失败：备份文件无效或已损坏" : "Restore failed: not a valid backup file",
      restored: zh ? "已从备份恢复：" : "Restored from "
    };
    return M[k] || k;
  }
  /* Newest first. Orders by real mtime, because a NAME-ONLY order is not safe:
     when an old copy is pruned its filename becomes free again and a newer copy
     can reuse it, which would make a reused name look oldest. The name is kept as
     a tiebreak, and the stamp carries milliseconds so that names stay
     chronologically ordered (fixed-width fields) even if mtime is unavailable. */
  listBackups(dir){
    const abs = normalizePath(dir || this.backupDir() || "");
    if(!abs) return [];
    const f = this.app.vault.getAbstractFileByPath(abs);
    if(!f || !f.children) return [];
    return f.children
      .filter(x => x instanceof TFile && /^wp-.*\.json$/.test(x.name))
      .sort((a,b)=>{
        const am = (a.stat && a.stat.mtime) || 0;
        const bm = (b.stat && b.stat.mtime) || 0;
        if(bm !== am) return bm - am;
        return a.name < b.name ? 1 : -1;
      });
  }
  async ensureVaultFolder(abs){
    let f = this.app.vault.getAbstractFileByPath(abs);
    if(!f){
      try{ await this.app.vault.createFolder(abs); }catch(e){ /* raced us there */ }
      f = this.app.vault.getAbstractFileByPath(abs);
    }
    return f;
  }
  /* Milliseconds included on purpose: it keeps the name a fixed-width,
     lexicographically sortable timestamp, so name order always matches time
     order even in the fallback path where mtime is unavailable. */
  backupStamp(d){
    const p = n => String(n).padStart(2,"0");
    return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+
           "_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds())+
           String(d.getMilliseconds()).padStart(3,"0");
  }
  /* Cheap content fingerprint, so an unchanged board costs nothing. */
  dataSignature(json){
    let h = 5381;
    for(let i=0;i<json.length;i++) h = ((h<<5)+h+json.charCodeAt(i))|0;
    return (h>>>0).toString(36)+":"+json.length;
  }
  async backupNow(force){
    if(!this.settings.backupEnabled && force !== true) return null;
    const dir = this.backupDir();
    if(!dir) return null;
    const json = JSON.stringify(this.data || {}, null, 2);
    const sig = this.dataSignature(json);
    if(force !== true && sig === this.backupSig) return null;   // nothing new
    try{
      await this.ensureVaultFolder(normalizePath(dir));
      /* Never reuse a name: a backup that silently replaces another backup is
         worse than no backup. The millisecond stamp makes collisions rare, and
         this probe is the safety net. The "_N" suffix is deliberate — ASCII '_'
         sorts after '.', so it keeps name order equal to time order. */
      const base = dir+"/wp-"+this.backupStamp(new Date());
      let path = normalizePath(base+".json");
      for(let n=2; this.app.vault.getAbstractFileByPath(path) && n<=99; n++){
        path = normalizePath(base+"_"+n+".json");
      }
      await this.app.vault.create(path, json);
      this.backupSig = sig;
      this.backupAt = Date.now();
      await this.pruneBackups(dir);
      if(force === true) new Notice(this.backupLabel("done")+path);
      return path;
    }catch(err){
      if(force === true) new Notice(this.backupLabel("fail")+(err&&err.message?err.message:err));
      return null;
    }
  }
  async pruneBackups(dir){
    const keep = Math.max(1, +this.settings.backupKeep || 30);
    for(const old of this.listBackups(dir).slice(keep)){
      try{ await this.app.vault.delete(old); }catch(e){ /* already gone */ }
    }
  }
  /* Debounced and rate limited: the board calls save() on every keystroke. */
  scheduleBackup(){
    if(!this.settings.backupEnabled) return;
    const every = Math.max(0, +this.settings.backupEveryMin || 0) * 60000;
    const elapsed = this.backupAt ? Date.now()-this.backupAt : 1e15;
    if(this.backupTimer) window.clearTimeout(this.backupTimer);
    this.backupTimer = window.setTimeout(()=>{
      this.backupTimer = null;
      this.backupNow(false);
    }, Math.max(3000, every-elapsed));
  }
  /* Snapshots the current state first, so a wrong pick is itself recoverable. */
  async restoreBackup(path){
    try{
      const f = this.app.vault.getAbstractFileByPath(path);
      if(!(f instanceof TFile)){ new Notice(this.backupLabel("bad")); return false; }
      const d = JSON.parse(await this.app.vault.read(f));
      if(!d || typeof d !== "object" || !d.periods) throw new Error("no periods");
      await this.backupNow(true);
      this.data = d;
      await this.saveData(d);
      this.backupSig = this.dataSignature(JSON.stringify(d, null, 2));
      this.refreshViews();
      new Notice(this.backupLabel("restored")+path);
      return true;
    }catch(err){
      new Notice(this.backupLabel("bad"));
      return false;
    }
  }
  async onunload(){
    /* Best effort. Obsidian fires this on disable/quit — exactly when a rollback
       may be about to happen — but it will not await us, so the write either
       lands or it does not. The fingerprint check keeps it from writing junk. */
    try{ this.backupNow(false); }catch(e){ /* a failed backup must never break the save that triggered it */ }
  }
  /* Open in the main editor area by default — the 7-column board needs width.
     Use the "Open in right sidebar" command (or drag the tab) for a side pane. */
  async activateView(side){
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if(!leaf){
      if(side){
        leaf = workspace.getRightLeaf(false) || workspace.getLeaf("tab");
      }else{
        leaf = workspace.getLeaf("tab");
      }
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
}

function defaultData(){
  const d = new Date();
  const day = (d.getDay()+6)%7;
  d.setDate(d.getDate()-day); d.setHours(0,0,0,0);
  const p = n => String(n).padStart(2,"0");
  const id = d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
  return {
    palette:"macaron",
    categories:["Study","Sport","Reading","Entertainment","Family Activity","Hobby"],
    habits:[],
    periods:{},
    currentId:id,
    counter:1,
    lang:"en"
  };
}

class WeeklyPlannerSettingTab extends PluginSettingTab {
  constructor(app, plugin){
    super(app, plugin);
    this.plugin = plugin;
  }
  isZh(){ return (this.plugin.settings.lang === "zh"); }
  label(en, zh){ return this.isZh() ? zh : en; }
  display(){
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("wp-settings");

    /* ---- interface language ---- */
    new Setting(containerEl)
      .setName(this.label("Interface language", "界面语言"))
      .setDesc(this.label("Language of the plugin UI.", "插件界面的显示语言。"))
      .addDropdown(d => d
        .addOption("en", "English")
        .addOption("zh", "中文")
        .setValue(this.plugin.settings.lang)
        .onChange(async v => {
          this.plugin.settings.lang = v;
          await this.plugin.saveSettings();
          this.display();
        }));

    /* ---- default palette ---- */
    new Setting(containerEl)
      .setName(this.label("Default palette", "默认配色"))
      .setDesc(this.label("Palette applied when creating new data.", "新建数据时使用的配色主题。"))
      .addDropdown(d => {
        Object.keys(PALETTE_NAMES).forEach(k => d.addOption(k, PALETTE_NAMES[k]));
        d.setValue(this.plugin.settings.defaultPalette)
          .onChange(async v => {
            this.plugin.settings.defaultPalette = v;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl).setName(this.label("Archive to Markdown", "Markdown 归档")).setHeading();

    /* ---- archive folder ---- */
    new Setting(containerEl)
      .setName(this.label("Archive folder", "归档文件夹"))
      .setDesc(this.label(
        "Vault-relative folder for generated Markdown files. Leave empty to write to the vault root. Created automatically if missing.",
        "生成的 Markdown 文件保存位置（库内相对路径）。留空则写入库根目录。目录不存在时会自动创建。"))
      .addText(txt => {
        txt.setPlaceholder("Weekly Planner")
          .setValue(this.plugin.settings.archiveFolder)
          .onChange(async v => {
            this.plugin.settings.archiveFolder = v.trim();
            await this.plugin.saveSettings();
          });
        txt.inputEl.addClass("wp-set-wide");
      })
      .addExtraButton(btn => btn
        .setIcon("folder-open")
        .setTooltip(this.label("Pick a folder", "选择文件夹"))
        .onClick(() => this.openFolderPicker()));

    /* ---- filename template ---- */
    new Setting(containerEl)
      .setName(this.label("Filename template", "文件名格式"))
      .setDesc(this.label(
        "Placeholders: {{start}}, {{end}}, {{year}}. Extension .md is appended automatically.",
        "可用占位符：{{start}}、{{end}}、{{year}}。扩展名 .md 会自动补上。"))
      .addText(txt => txt
        .setPlaceholder("{{start}}")
        .setValue(this.plugin.settings.filenameTemplate)
        .onChange(async v => {
          this.plugin.settings.filenameTemplate = v.trim() || "{{start}}";
          await this.plugin.saveSettings();
        }));

    /* ---- date format ---- */
    new Setting(containerEl)
      .setName(this.label("Date format", "日期格式"))
      .setDesc(this.label("Format for dates inside the archive file.", "归档文件内日期的显示格式。"))
      .addDropdown(d => d
        .addOption("YYYY-MM-DD", "2026-09-18")
        .addOption("YYYY/MM/DD", "2026/09/18")
        .addOption("YYYY年MM月DD日", "2026年09月18日")
        .addOption("MM-DD", "09-18")
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async v => {
          this.plugin.settings.dateFormat = v;
          await this.plugin.saveSettings();
        }));

    /* ---- include completed ---- */
    new Setting(containerEl)
      .setName(this.label("Include completed tasks", "包含已完成任务"))
      .setDesc(this.label("Write finished tasks into the archive file.", "归档时是否写入已完成的任务。"))
      .addToggle(tg => tg
        .setValue(this.plugin.settings.includeCompleted)
        .onChange(async v => {
          this.plugin.settings.includeCompleted = v;
          await this.plugin.saveSettings();
        }));

    /* ---- auto archive ---- */
    new Setting(containerEl)
      .setName(this.label("Auto archive on archive week", "归档周时自动写入"))
      .setDesc(this.label(
        "Automatically write the Markdown file when a period is archived.",
        "点击「归档本周」时自动生成对应的 Markdown 文件。"))
      .addToggle(tg => tg
        .setValue(this.plugin.settings.autoArchive)
        .onChange(async v => {
          this.plugin.settings.autoArchive = v;
          await this.plugin.saveSettings();
        }));

    /* ---- preview ---- */
    const preview = containerEl.createEl("div", { cls: "wp-set-preview" });
    preview.createEl("div", {
      cls: "wp-set-preview-label",
      text: this.label("File will be saved to:", "文件将保存至：")
    });
    const fp = (this.plugin.settings.archiveFolder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const s = this.plugin.settings;
    const sample = (s.filenameTemplate || "{{start}}")
      .replace(/\{\{start\}\}/g, "2026-09-14")
      .replace(/\{\{end\}\}/g, "2026-09-20")
      .replace(/\{\{year\}\}/g, "2026")
      .replace(/[\\/:*?"<>|]/g, "-");
    preview.createEl("code", { text: (fp ? fp + "/" : "") + sample + ".md" });

    new Setting(containerEl).setName(this.label("Automatic backup", "自动备份")).setHeading();

    /* ---- backup on/off ---- */
    new Setting(containerEl)
      .setName(this.label("Enable automatic backup", "启用自动备份"))
      .setDesc(this.label(
        "Writes a timestamped copy of all planner data into a vault folder. Kept outside the plugin folder on purpose — when Obsidian rolls back a plugin it deletes that folder together with data.json, while these copies stay put.",
        "把计划数据按时间戳另存一份到库内文件夹。特意放在插件目录之外：Obsidian 回滚插件时会连 data.json 一起删掉，而这些副本不受影响。"))
      .addToggle(tg => tg
        .setValue(this.plugin.settings.backupEnabled)
        .onChange(async v => {
          this.plugin.settings.backupEnabled = v;
          await this.plugin.saveSettings();
          this.display();
        }));

    /* ---- backup folder ---- */
    new Setting(containerEl)
      .setName(this.label("Backup folder", "备份文件夹"))
      .setDesc(this.label(
        "Vault-relative folder for the copies; created automatically. Keep it outside the plugin's own folder so a plugin rollback cannot touch it.",
        "副本保存的库内相对路径，不存在时会自动创建。请放在插件自身目录之外，这样插件回滚不会波及。"))
      .addText(txt => {
        txt.setPlaceholder("_weekly-planner-backup")
          .setValue(this.plugin.settings.backupFolder)
          .onChange(async v => {
            this.plugin.settings.backupFolder = v.trim();
            await this.plugin.saveSettings();
          });
        txt.inputEl.addClass("wp-set-wide");
      })
      .addExtraButton(btn => btn
        .setIcon("folder-open")
        .setTooltip(this.label("Pick a folder", "选择文件夹"))
        .onClick(() => this.openFolderPicker("backupFolder")));

    /* ---- interval ---- */
    new Setting(containerEl)
      .setName(this.label("Backup interval", "备份间隔"))
      .setDesc(this.label(
        "Shortest gap between two automatic copies. Edits are debounced by 3 s, so a burst of typing still produces only one copy.",
        "两次自动备份之间的最短间隔。改动会先延迟 3 秒再写，所以连续编辑只会产生一份副本。"))
      .addDropdown(d => d
        .addOption("0", this.label("Every change", "每次改动"))
        .addOption("1", this.label("1 minute", "1 分钟"))
        .addOption("5", this.label("5 minutes", "5 分钟"))
        .addOption("15", this.label("15 minutes", "15 分钟"))
        .addOption("60", this.label("1 hour", "1 小时"))
        .setValue(String(this.plugin.settings.backupEveryMin))
        .onChange(async v => {
          this.plugin.settings.backupEveryMin = +v;
          await this.plugin.saveSettings();
        }));

    /* ---- retention ---- */
    new Setting(containerEl)
      .setName(this.label("Copies to keep", "保留份数"))
      .setDesc(this.label(
        "Older copies beyond this count are deleted automatically.",
        "超出该份数的旧副本会被自动清理。"))
      .addDropdown(d => d
        .addOption("10", "10")
        .addOption("30", "30")
        .addOption("60", "60")
        .addOption("120", "120")
        .setValue(String(this.plugin.settings.backupKeep))
        .onChange(async v => {
          this.plugin.settings.backupKeep = +v;
          await this.plugin.saveSettings();
        }));

    /* ---- back up now ---- */
    const backups = this.plugin.listBackups();
    new Setting(containerEl)
      .setName(this.label("Back up now", "立即备份"))
      .setDesc(this.plugin.backupDir()
        ? this.label(backups.length + " copy(ies) currently in the folder.",
                     "该文件夹内现有 " + backups.length + " 份副本。")
        : this.label("Set a backup folder first.", "请先设置备份文件夹。"))
      .addButton(btn => btn
        .setButtonText(this.label("Back up now", "立即备份"))
        .setCta()
        .onClick(async () => {
          const p = await this.plugin.backupNow(true);
          if(p) this.display();
        }));

    /* ---- restore ---- */
    if(backups.length){
      let pick = backups[0].path;
      new Setting(containerEl)
        .setName(this.label("Restore from backup", "从备份恢复"))
        .setDesc(this.label(
          "Overwrites the current planner data. The current state is copied first, so a wrong pick can be undone the same way.",
          "会覆盖当前计划数据。覆盖前会先自动备份当前状态，所以选错了也能用同样方式退回。"))
        .addDropdown(d => {
          backups.slice(0, 20).forEach(f => d.addOption(f.path, f.name));
          d.setValue(pick).onChange(v => { pick = v; });
        })
        .addButton(btn => btn
          .setButtonText(this.label("Restore", "恢复"))
          .setClass("mod-warning")
          .onClick(async () => {
            const ok = await this.plugin.restoreBackup(pick);
            if(ok) this.display();
          }));
    }

    new Setting(containerEl).setName(this.label("View", "视图")).setHeading();

    /* ---- week starts on ---- */
    new Setting(containerEl)
      .setName(this.label("Week starts on", "每周起始日"))
      .setDesc(this.label("Which day the week begins. Takes effect on newly created periods.", "一周从哪天开始，对新建周期生效。"))
      .addDropdown(d => d
        .addOption("1", this.label("Monday", "周一"))
        .addOption("0", this.label("Sunday", "周日"))
        .setValue(String(this.plugin.settings.weekStartsOn))
        .onChange(async v => {
          this.plugin.settings.weekStartsOn = +v;
          await this.plugin.saveSettings();
        }));

    /* ---- show daily chart ---- */
    new Setting(containerEl)
      .setName(this.label("Show daily chart button", "显示每日图表按钮"))
      .setDesc(this.label("Toggle the Daily Chart button on each day column.", "是否在日期列显示 Daily Chart 按钮。"))
      .addToggle(tg => tg
        .setValue(this.plugin.settings.showDailyChart)
        .onChange(async v => {
          this.plugin.settings.showDailyChart = v;
          await this.plugin.saveSettings();
        }));
  }
  /* Shared by the archive folder and the backup folder fields. */
  openFolderPicker(field){
    const key = field || "archiveFolder";
    const folders = this.app.vault.getAllLoadedFiles()
      .filter(f => f.children)
      .map(f => f.path)
      .filter(p => p && p !== "/")
      .sort();
    const modal = new FolderSuggestModal(this.app, folders, async (p) => {
      this.plugin.settings[key] = p;
      await this.plugin.saveSettings();
      this.display();
    });
    modal.open();
  }
}

class FolderSuggestModal extends SuggestModal {
  constructor(app, folders, onPick){
    super(app);
    this.folders = folders;
    this.onPick = onPick;
    this.setPlaceholder("Type to filter folders…");
  }
  getSuggestions(query){
    const q = (query || "").toLowerCase();
    return this.folders.filter(f => f.toLowerCase().includes(q));
  }
  renderSuggestion(folder, el){ el.setText(folder); }
  onChooseSuggestion(folder){ this.onPick(folder); }
}

/* eslint-disable-next-line no-undef -- `module` is the CommonJS export object provided by the plugin loader, not a browser global. */
module.exports = WeeklyPlannerPlugin;
