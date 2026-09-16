import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, Trash2, Edit3, Eye, Image as ImageIcon, Download, Save,
  ChevronDown, ChevronUp, GripVertical, Settings2, FileText, LayoutTemplate,
  Gift, Search, Check, X, Upload, ArrowLeft, ExternalLink, LogOut, Mail, Lock,
  MessageCircle, Instagram
} from "lucide-react";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const uid = () => crypto.randomUUID();
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const finalPrice = (t) => {
  const p = Number(t?.price)||0, d = Math.min(100, Math.max(0, Number(t?.discount_percentage)||0));
  return Math.round((p - (p*d/100)) * 100) / 100;
};
const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

// Writes a single change to Supabase. Called after every local admin edit so
// the change survives a refresh instead of living only in React state.
async function persist(table, action, payload) {
  if (!supabase) return true;
  try {
    const q = action === "upsert"
      ? supabase.from(table).upsert(payload)
      : supabase.from(table).delete().eq("id", payload);
    const { error } = await q;
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(`Supabase ${action} on ${table} failed:`, e);
    alert(`Could not save this change to the database: ${e.message}`);
    return false;
  }
}

// Used by the "Country" and "Mobile number" field types in the form builder.
const COUNTRIES = [
  ["India","+91"],["United States","+1"],["United Kingdom","+44"],["United Arab Emirates","+971"],
  ["Canada","+1"],["Australia","+61"],["Singapore","+65"],["Saudi Arabia","+966"],["Qatar","+974"],
  ["Kuwait","+965"],["Bahrain","+973"],["Oman","+968"],["Pakistan","+92"],["Bangladesh","+880"],
  ["Sri Lanka","+94"],["Nepal","+977"],["Germany","+49"],["France","+33"],["Italy","+39"],
  ["Spain","+34"],["Netherlands","+31"],["Switzerland","+41"],["Sweden","+46"],["Ireland","+353"],
  ["Malaysia","+60"],["Indonesia","+62"],["Thailand","+66"],["Philippines","+63"],["Vietnam","+84"],
  ["Japan","+81"],["South Korea","+82"],["China","+86"],["Hong Kong","+852"],["New Zealand","+64"],
  ["South Africa","+27"],["Nigeria","+234"],["Kenya","+254"],["Egypt","+20"],["Brazil","+55"],
  ["Mexico","+52"],["Russia","+7"],["Turkey","+90"],["Israel","+972"]
];

// 10 accent color presets an admin can pick from Settings — applied to the
// customer-facing side only (buttons, price tags, active states).
const THEMES = [
  ["theme-1","Royal Gold","#b8862b"],
  ["theme-2","Blush Rose","#e0668c"],
  ["theme-3","Wine Maroon","#8a2540"],
  ["theme-4","Terracotta","#c1502e"],
  ["theme-5","Amber Honey","#c9820a"],
  ["theme-6","Coral Sunset","#e2685c"],
  ["theme-7","Plum Berry","#8e3b6d"],
  ["theme-8","Emerald Luxe","#0f7a5c"],
  ["theme-9","Sapphire Night","#2a4d8f"],
  ["theme-10","Peach Cream","#d98f5c"]
];

const demoData = {
  gifts: [
    { id: "birthday", name: "Birthday", emoji: "🎂", active: true, sort_order: 1 },
    { id: "rakhi", name: "Rakhi", emoji: "🎁", active: true, sort_order: 2 },
    { id: "anniversary", name: "Anniversary", emoji: "❤️", active: true, sort_order: 3 }
  ],
  templates: [
    { id: "t-bday-1", gift_id: "birthday", name: "Birthday Cute", description: "Soft and cute birthday surprise", price: 299, preview_url: "", preview_urls: [], active: true, sort_order: 1 },
    { id: "t-bday-2", gift_id: "birthday", name: "Birthday Premium", description: "Elegant birthday experience", price: 499, preview_url: "", preview_urls: [], active: true, sort_order: 2 },
    { id: "t-rakhi-1", gift_id: "rakhi", name: "Rakhi Memories", description: "A warm family memory template", price: 349, preview_url: "", preview_urls: [], active: true, sort_order: 1 }
  ],
  sections: [
    {
      id: "s1", template_id: "t-bday-1", title: "Personal Details", sort_order: 1, active: true,
      fields: [
        { id: "f1", type: "text", label: "Name", placeholder: "Enter their name", required: true, active: true, sort_order: 1 },
        { id: "f2", type: "text", label: "Nickname", placeholder: "Optional", required: false, active: true, sort_order: 2 }
      ]
    },
    {
      id: "s2", template_id: "t-bday-1", title: "Special Message", sort_order: 2, active: true,
      fields: [
        { id: "f3", type: "textarea", label: "Birthday Message", placeholder: "Write your special message...", required: true, active: true, sort_order: 1 },
        { id: "f4", type: "textarea", label: "Secret Message", placeholder: "Something private or extra...", required: false, active: true, sort_order: 2 }
      ]
    },
    {
      id: "s3", template_id: "t-bday-1", title: "Memories", sort_order: 3, active: true,
      fields: [
        { id: "f5", type: "image", label: "Main Photo", placeholder: "", required: true, active: true, sort_order: 1, max_files: 1 },
        { id: "f6", type: "images", label: "Memory Photos", placeholder: "", required: false, active: true, sort_order: 2, max_files: 8 }
      ]
    }
  ],
  submissions: [],
  settings: { whatsapp_number: "", instagram_url: "", contact_whatsapp_url: "", theme: "theme-1" }
};

function App() {
  const [route, setRoute] = useState(location.pathname.startsWith("/admin") ? "admin" : "user");
  const [data, setData] = useState(demoData);
  const [dbReady, setDbReady] = useState(false);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(location.pathname.startsWith("/admin") ? "admin" : "user");
    addEventListener("popstate", onPop);
    loadCatalog();

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setAuthChecked(true);
        if (session) loadSubmissions();
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) loadSubmissions();
        else setData(d => ({ ...d, submissions: [] }));
      });
      return () => { removeEventListener("popstate", onPop); sub.subscription.unsubscribe(); };
    }
    setAuthChecked(true);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // Gift types, templates, sections and fields are readable by anyone (RLS: public select)
  // so the customer-facing form works without logging in.
  async function loadCatalog() {
    if (!supabase) return;
    try {
      const [{ data: gifts }, { data: templates }, { data: sections }, { data: fields }, { data: settingsRows }] =
        await Promise.all([
          supabase.from("gift_types").select("*").order("sort_order"),
          supabase.from("templates").select("*").order("sort_order"),
          supabase.from("form_sections").select("*").order("sort_order"),
          supabase.from("form_fields").select("*").order("sort_order"),
          supabase.from("site_settings").select("*").eq("id", 1).limit(1)
        ]);
      if (gifts && templates && sections && fields) {
        const sectionMap = {};
        sections.forEach(s => sectionMap[s.id] = { ...s, fields: [] });
        fields.forEach(f => sectionMap[f.section_id]?.fields.push(f));
        setData(d => ({
          ...d, gifts, templates, sections: Object.values(sectionMap),
          settings: settingsRows?.[0] ? { ...d.settings, ...settingsRows[0] } : d.settings
        }));
        setDbReady(true);
      }
    } catch (e) {
      console.warn("Supabase catalog load failed; demo mode remains active.", e);
    }
  }

  // Submissions contain customer PII, so RLS restricts reading them to logged-in admins.
  // This is only called once an admin session exists. Also pulls each submission's
  // answers and uploaded photos (as signed URLs, since the storage bucket is private).
  async function loadSubmissions() {
    if (!supabase) return;
    try {
      const { data: submissions, error } = await supabase
        .from("submissions")
        .select("*, submission_values(*), submission_files(*)")
        .order("created_at", { ascending: false });
      if (error || !submissions) return;

      const withUrls = await Promise.all(submissions.map(async s => {
        const images = await Promise.all((s.submission_files||[]).map(async f => {
          const { data: signed } = await supabase.storage.from("submission-images").createSignedUrl(f.file_path, 3600);
          return { name: f.file_name, url: signed?.signedUrl || null };
        }));
        return { ...s, images };
      }));

      setData(d => {
        const fieldLabel = id => d.sections.flatMap(sec=>sec.fields||[]).find(f=>f.id===id)?.label || id;
        const enriched = withUrls.map(s => ({
          ...s,
          gift_name: d.gifts.find(g=>g.id===s.gift_id)?.name || "—",
          template_name: d.templates.find(t=>t.id===s.template_id)?.name || "—",
          values: Object.fromEntries((s.submission_values||[]).map(v => {
            let val = v.value_json;
            if (typeof val === "string") { try { val = JSON.parse(val); } catch {} }
            return [fieldLabel(v.field_id), val];
          }))
        }));
        return { ...d, submissions: enriched };
      });
    } catch (e) {
      console.warn("Supabase submissions load failed.", e);
    }
  }

  function navigate(path) {
    history.pushState({}, "", path);
    setRoute(path.startsWith("/admin") ? "admin" : "user");
  }

  // With no Supabase configured, admin stays open (demo mode, nothing to protect).
  const adminUnlocked = !supabase || !!session;

  return route === "admin"
    ? (!authChecked
        ? <div className="admin-login"><div className="admin-login-glow admin-login-glow-1"/><div className="admin-login-glow admin-login-glow-2"/><div className="admin-login-card"><div className="admin-login-mark"><Gift size={26}/></div><p className="muted-text">Loading…</p></div></div>
        : adminUnlocked
          ? <Admin data={data} setData={setData} navigate={navigate} dbReady={dbReady} onLogout={() => supabase?.auth.signOut()} />
          : <AdminLogin />)
    : <User data={data} setData={setData} navigate={navigate} supabase={supabase} />;
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) setErr(error.message);
    // On success, onAuthStateChange in App() picks up the new session automatically.
  }

  return (
    <div className="admin-login">
      <div className="admin-login-glow admin-login-glow-1"/>
      <div className="admin-login-glow admin-login-glow-2"/>
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-mark"><Gift size={26}/></div>
        <h2>Surprizyy</h2>
        <p className="admin-login-sub">Sign in to manage your store</p>
        <label className="admin-login-field">
          <Mail size={17}/>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus autoComplete="username"/>
        </label>
        <label className="admin-login-field">
          <Lock size={17}/>
          <input type="password" placeholder="Password" value={pwd} onChange={e=>setPwd(e.target.value)} autoComplete="current-password"/>
        </label>
        {err && <p className="error-text">{err}</p>}
        <button className="primary admin-login-btn" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign In"}</button>
      </form>
    </div>
  );
}

function Admin({ data, setData, navigate, dbReady, onLogout }) {
  const [tab, setTab] = useState("submissions");
  const [selectedGift, setSelectedGift] = useState(data.gifts[0]?.id);
  const [selectedTemplate, setSelectedTemplate] = useState(data.templates.find(t => t.gift_id === selectedGift)?.id);
  const [editingGift, setEditingGift] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [viewSubmission, setViewSubmission] = useState(null);

  const templates = data.templates.filter(t => t.gift_id === selectedGift);
  const sections = data.sections.filter(s => s.template_id === selectedTemplate).sort((a,b) => a.sort_order-b.sort_order);

  useEffect(() => {
    if (!templates.some(t => t.id === selectedTemplate)) setSelectedTemplate(templates[0]?.id);
  }, [selectedGift, data.templates.length]);

  function update(updater) { setData(d => updater(structuredClone(d))); }

  async function addGift() {
    const name = prompt("Gift type name:", "New Gift");
    if (!name) return;
    const id = uid();
    const gift = { id, name, emoji:"🎁", active:true, sort_order:data.gifts.length+1 };
    update(d => { d.gifts.push(gift); return d; });
    setSelectedGift(id);
    const ok = await persist("gift_types", "upsert", gift);
    if (!ok) { update(d => { d.gifts=d.gifts.filter(x=>x.id!==id); return d; }); setSelectedGift(null); }
  }
  async function addTemplate() {
    if (!selectedGift) return;
    const name = prompt("Template name:", "New Template");
    if (!name) return;
    const id = uid();
    const template = { id, gift_id:selectedGift, name, description:"", price:0, preview_url:"", preview_urls:[], active:true, sort_order:data.templates.filter(x=>x.gift_id===selectedGift).length+1 };
    update(d => { d.templates.push(template); return d; });
    setSelectedTemplate(id);
    const ok = await persist("templates", "upsert", template);
    if (!ok) { update(d => { d.templates=d.templates.filter(x=>x.id!==id); return d; }); setSelectedTemplate(null); }
  }
  async function addSection() {
    if (!selectedTemplate) return;
    const section = { id:uid(), template_id:selectedTemplate, title:"New Section", sort_order:sections.length+1, active:true };
    update(d => { d.sections.push({...section, fields:[]}); return d; });
    setEditingSection({...section, fields:[]});
    const ok = await persist("form_sections", "upsert", section);
    if (!ok) { update(d => { d.sections=d.sections.filter(x=>x.id!==section.id); return d; }); setEditingSection(null); }
  }
  async function addField(sectionId) {
    const field = { id:uid(), section_id:sectionId, type:"text", label:"New Field", placeholder:"", required:false, active:true, sort_order:(data.sections.find(s=>s.id===sectionId)?.fields?.length||0)+1, max_files:5, options:[] };
    update(d => { d.sections.find(s=>s.id===sectionId)?.fields.push(field); return d; });
    setEditingField({ ...field, section_id:sectionId });
    const ok = await persist("form_fields", "upsert", field);
    if (!ok) { update(d => { const s=d.sections.find(x=>x.id===sectionId); if(s) s.fields=s.fields.filter(f=>f.id!==field.id); return d; }); setEditingField(null); }
  }
  function deleteGift(id) {
    if (!confirm("Delete this gift type and its templates?")) return;
    update(d => {
      const tids = d.templates.filter(t=>t.gift_id===id).map(t=>t.id);
      d.gifts = d.gifts.filter(x=>x.id!==id);
      d.templates = d.templates.filter(x=>x.gift_id!==id);
      d.sections = d.sections.filter(x=>!tids.includes(x.template_id));
      return d;
    });
    persist("gift_types", "delete", id); // form_sections/templates cascade in Supabase via FK
  }
  function deleteTemplate(id) {
    if (!confirm("Delete this template and its form?")) return;
    update(d => { d.templates=d.templates.filter(x=>x.id!==id); d.sections=d.sections.filter(x=>x.template_id!==id); return d; });
    persist("templates", "delete", id);
  }
  function deleteSection(id) {
    update(d => { d.sections=d.sections.filter(x=>x.id!==id); return d; });
    persist("form_sections", "delete", id);
  }
  function deleteField(sectionId, fieldId) {
    update(d => { const s=d.sections.find(x=>x.id===sectionId); if(s) s.fields=s.fields.filter(f=>f.id!==fieldId); return d; });
    persist("form_fields", "delete", fieldId);
  }
  function saveSection(v) {
    if (!v) return;
    update(d => { const s=d.sections.find(x=>x.id===v.id); if(s) Object.assign(s, v); return d; });
    const { fields, ...row } = v; // fields isn't a column on form_sections
    persist("form_sections", "upsert", row);
    setEditingSection(null);
  }
  function saveField(v) {
    if (!v) return;
    update(d => { const s=d.sections.find(x=>x.id===v.section_id); const f=s?.fields.find(x=>x.id===v.id); if(f) Object.assign(f, v); return d; });
    persist("form_fields", "upsert", v);
    setEditingField(null);
  }
  function saveGift(v) {
    update(d => { d.gifts = d.gifts.map(x=>x.id===v.id?v:x); return d; });
    persist("gift_types", "upsert", v);
    setEditingGift(null);
  }
  function saveTemplate(v) {
    update(d => { d.templates = d.templates.map(x=>x.id===v.id?v:x); return d; });
    persist("templates", "upsert", v);
    setEditingTemplate(null);
  }
  function saveSettings(v) {
    update(d => { d.settings = v; return d; });
    persist("site_settings", "upsert", { id:1, ...v });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><span>Surprizyy</span></div>
        <nav>
          <button className={tab==="submissions"?"active":""} onClick={()=>setTab("submissions")}><FileText/>Submissions</button>
          <button className={tab==="gifts"?"active":""} onClick={()=>setTab("gifts")}><Gift/>Gift Types</button>
          <button className={tab==="templates"?"active":""} onClick={()=>setTab("templates")}><LayoutTemplate/>Templates</button>
          <button className={tab==="builder"?"active":""} onClick={()=>setTab("builder")}><Settings2/>Form Builder</button>
          <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings2/>Settings</button>
        </nav>
        <button className="view-user" onClick={()=>navigate("/")}><ExternalLink/>Open User Panel</button>
        {onLogout && <button className="view-user" onClick={onLogout}><LogOut/>Logout</button>}
        <div className="sidebar-foot">{dbReady ? "Supabase connected" : "Demo mode"}<span className={dbReady?"dot green":"dot"} /></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">ADMIN PANEL</div>
            <h1>{tab==="submissions"?"Submissions":tab==="gifts"?"Gift Types":tab==="templates"?"Templates":tab==="settings"?"Settings":"Form Builder"}</h1>
          </div>
          {tab==="submissions" && <div className="searchbox"><Search size={17}/><input placeholder="Search submissions..." /></div>}
        </header>

        {tab==="submissions" && <Submissions data={data} onView={setViewSubmission}/>}
        {tab==="gifts" && <GiftManager data={data} setData={setData} onAdd={addGift} onDelete={deleteGift} onEdit={setEditingGift}/>}
        {tab==="templates" && <TemplateManager data={data} selectedGift={selectedGift} setSelectedGift={setSelectedGift} templates={templates} onAdd={addTemplate} onDelete={deleteTemplate} onEdit={setEditingTemplate}/>}
        {tab==="settings" && <SettingsPanel settings={data.settings} onSave={saveSettings}/>}
        {tab==="builder" && (
          <div className="builder-layout">
            <div className="builder-controls">
              <label>Gift Type<select value={selectedGift||""} onChange={e=>setSelectedGift(e.target.value)}>{data.gifts.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select></label>
              <label>Template<select value={selectedTemplate||""} onChange={e=>setSelectedTemplate(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></label>
            </div>
            <div className="builder-head"><div><h2>Form structure</h2><p>Add sections and fields. Changes are reflected in the user panel.</p></div><button className="primary" onClick={addSection}><Plus size={18}/>Add section</button></div>
            {sections.map((section, i)=>
              <section className="builder-section" key={section.id}>
                <div className="section-head">
                  <div className="section-title"><GripVertical size={18}/><strong>{section.title}</strong>{!section.active && <span className="badge muted">Hidden</span>}</div>
                  <div className="row-actions">
                    <button title="Move up" disabled={i===0} onClick={()=>moveSection(data,setData,selectedTemplate,section.id,-1)}><ChevronUp/></button>
                    <button title="Move down" disabled={i===sections.length-1} onClick={()=>moveSection(data,setData,selectedTemplate,section.id,1)}><ChevronDown/></button>
                    <button onClick={()=>setEditingSection({...section})}><Edit3/></button>
                    <button className="danger-icon" onClick={()=>deleteSection(section.id)}><Trash2/></button>
                  </div>
                </div>
                <div className="field-list">
                  {section.fields?.sort((a,b)=>a.sort_order-b.sort_order).map((field,fi)=>
                    <div className={"field-row "+(!field.active?"disabled":"")} key={field.id}>
                      <GripVertical size={16}/><div className="field-main"><strong>{field.label}</strong><span>{field.type} {field.required?"• Required":"• Optional"}</span></div>
                      <button onClick={()=>setEditingField({...field,section_id:section.id})}><Edit3/></button>
                      <button className="danger-icon" onClick={()=>deleteField(section.id,field.id)}><Trash2/></button>
                    </div>
                  )}
                  <button className="add-field" onClick={()=>addField(section.id)}><Plus size={16}/>Add field</button>
                </div>
              </section>
            )}
            {!sections.length && <Empty title="No sections yet" text="Create your first section for this template." action={addSection}/>}
          </div>
        )}

        {editingGift && <GiftModal value={editingGift} onClose={()=>setEditingGift(null)} onSave={saveGift}/>}
        {editingTemplate && <TemplateModal value={editingTemplate} onClose={()=>setEditingTemplate(null)} onSave={saveTemplate}/>}
        {editingSection && <SectionModal value={editingSection} onClose={()=>setEditingSection(null)} onSave={saveSection}/>}
        {editingField && <FieldModal value={editingField} onClose={()=>setEditingField(null)} onSave={saveField}/>}
        {viewSubmission && <SubmissionModal submission={viewSubmission} onClose={()=>setViewSubmission(null)}/>}
      </main>
    </div>
  );
}

function moveSection(data,setData,templateId,id,delta) {
  setData(d => {
    const arr=d.sections.filter(s=>s.template_id===templateId).sort((a,b)=>a.sort_order-b.sort_order);
    const i=arr.findIndex(s=>s.id===id), j=i+delta;
    if(i<0||j<0||j>=arr.length) return d;
    [arr[i].sort_order,arr[j].sort_order]=[arr[j].sort_order,arr[i].sort_order];
    persist("form_sections","upsert",{id:arr[i].id, sort_order:arr[i].sort_order});
    persist("form_sections","upsert",{id:arr[j].id, sort_order:arr[j].sort_order});
    return {...d,sections:[...d.sections]};
  });
}

function Submissions({data,onView}) {
  if(!data.submissions.length) return <Empty title="No submissions yet" text="Customer forms will appear here after they submit." />;
  return <div className="card table-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Gift</th><th>Template</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
    {data.submissions.map(s=><tr key={s.id}><td><code>{String(s.id).slice(0,8)}</code></td><td><strong>{s.customer_name||s.values?.Name||"—"}</strong></td><td>{s.gift_name||"—"}</td><td>{s.template_name||"—"}</td><td>{s.created_at?new Date(s.created_at).toLocaleString():"—"}</td><td><span className="badge">{s.status||"New"}</span></td><td><button className="small-button" onClick={()=>onView(s)}><Eye size={15}/>View</button></td></tr>)}
  </tbody></table></div>
}

function GiftManager({data,setData,onAdd,onDelete,onEdit}) {
  return <div className="content">
    <div className="page-actions"><p>Create the categories customers can choose from.</p><button className="primary" onClick={onAdd}><Plus/>Add gift type</button></div>
    <div className="grid-cards">{data.gifts.map(g=><div className="manager-card" key={g.id}>
      <div className="big-icon">{g.emoji||"🎁"}</div><div className="manager-info"><h3>{g.name}</h3><span>{data.templates.filter(t=>t.gift_id===g.id).length} templates</span></div>
      <div className="card-actions"><button onClick={()=>onEdit({...g})}><Edit3/>Edit</button><button className="danger" onClick={()=>onDelete(g.id)}><Trash2/>Delete</button></div>
    </div>)}</div>
  </div>
}

function TemplateManager({data,selectedGift,setSelectedGift,templates,onAdd,onDelete,onEdit}) {
  return <div className="content">
    <div className="builder-controls"><label>Gift Type<select value={selectedGift||""} onChange={e=>setSelectedGift(e.target.value)}>{data.gifts.map(g=><option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select></label></div>
    <div className="page-actions"><p>Templates belong to the selected gift type.</p><button className="primary" onClick={onAdd}><Plus/>Add template</button></div>
    <div className="grid-cards">{templates.map(t=><div className="template-card" key={t.id}>
      <div className="preview">{(t.preview_urls?.[0]||t.preview_url)?<img src={t.preview_urls?.[0]||t.preview_url} alt=""/>:<LayoutTemplate size={34}/>}</div>
      <div className="manager-info"><h3>{t.name}</h3><span>{t.description||"No description"}</span>{!!t.price && <span className="price-tag">{t.discount_percentage>0 ? <>₹{finalPrice(t)} <s>₹{t.price}</s> <em className="discount-badge">{t.discount_percentage}% OFF</em></> : `₹${t.price}`}</span>}</div>
      <div className="card-actions"><button onClick={()=>onEdit({...t})}><Edit3/>Edit</button><button className="danger" onClick={()=>onDelete(t.id)}><Trash2/>Delete</button></div>
    </div>)}</div>
  </div>
}

function SettingsPanel({settings, onSave}) {
  const [v, setV] = useState(settings);
  useEffect(() => { setV(settings); }, [settings]);
  return (
    <div className="content settings-panel">
      <div className="settings-card">
        <h3>Contact &amp; WhatsApp</h3>
        <p className="muted-text">Used for the floating WhatsApp button and the contact icons shown to customers on every page.</p>
        <label>WhatsApp number (with country code, no + or spaces)
          <input value={v.whatsapp_number||""} onChange={e=>setV({...v,whatsapp_number:e.target.value})} placeholder="919876543210"/>
        </label>
        <label>Instagram profile URL
          <input value={v.instagram_url||""} onChange={e=>setV({...v,instagram_url:e.target.value})} placeholder="https://instagram.com/yourhandle"/>
        </label>
      </div>
      <div className="settings-card">
        <h3>Theme color</h3>
        <p className="muted-text">Sets the accent color across the customer-facing site — buttons, price tags, active steps.</p>
        <div className="theme-grid">
          {THEMES.map(([id,name,color]) =>
            <button type="button" key={id} className={"theme-swatch"+(v.theme===id?" active":"")} style={{background:color}} onClick={()=>setV({...v,theme:id})} title={name}>
              {v.theme===id && <Check size={16}/>}
            </button>
          )}
        </div>
      </div>
      <button className="primary" onClick={()=>onSave(v)}><Save size={17}/> Save settings</button>
    </div>
  );
}

function User({data,setData,navigate,supabase}) {
  const [step,setStep]=useState(1), [gift,setGift]=useState(null), [template,setTemplate]=useState(null), [values,setValues]=useState({}), [files,setFiles]=useState({}), [done,setDone]=useState(false), [busy,setBusy]=useState(false);
  const activeGifts=data.gifts.filter(g=>g.active).sort((a,b)=>a.sort_order-b.sort_order);
  const templates=data.templates.filter(t=>t.gift_id===gift?.id && t.active).sort((a,b)=>a.sort_order-b.sort_order);
  const sections=data.sections.filter(s=>s.template_id===template?.id && s.active).sort((a,b)=>a.sort_order-b.sort_order);

  function setVal(id,val){setValues(v=>({...v,[id]:val}));}
  function selectGift(g){setGift(g);setTemplate(null);setStep(2);}
  function selectTemplate(t){setTemplate(t);setStep(3);}
  const amount = template ? finalPrice(template) : 0;
  const hasPayment = amount > 0;

  function validateRequired() {
    const required=sections.flatMap(s=>s.fields||[]).filter(f=>f.active&&f.required);
    for(const f of required) {
      const empty = f.type==="image"||f.type==="images" ? !(files[f.id]?.length)
        : f.type==="phone" ? !values[f.id]?.number
        : !values[f.id];
      if (empty) { alert(`Please complete: ${f.label}`); return false; }
    }
    return true;
  }

  function proceedFromDetails() {
    if (!validateRequired()) return;
    if (hasPayment) setStep(5); else submit();
  }

  function payNow() {
    if (!window.Razorpay || !razorpayKeyId) { alert("Payments aren't set up yet. Please contact the site owner."); return; }
    setBusy(true);
    const rzp = new window.Razorpay({
      key: razorpayKeyId,
      amount: Math.round(amount*100),
      currency: "INR",
      name: "Surprizyy",
      description: template.name,
      handler: (response) => submit({ razorpay_payment_id: response.razorpay_payment_id, payment_status: "paid" }),
      modal: { ondismiss: () => setBusy(false) }
    });
    rzp.open();
  }

  async function submit(payment) {
    if (!validateRequired()) { setBusy(false); return; }
    setBusy(true);
    const submissionId=uid();
    let fileRecords=[];
    if(supabase) {
      try {
        const rows = [];
        for (const s of sections) for (const f of s.fields||[]) {
          if(values[f.id] !== undefined) rows.push({ submission_id:submissionId, field_id:f.id, value_json:JSON.stringify(values[f.id]) });
          for(const file of (files[f.id]||[])) {
            const path=`submissions/${submissionId}/${uid()}-${file.name}`;
            const {error}=await supabase.storage.from("submission-images").upload(path,file);
            if(!error) fileRecords.push({submission_id:submissionId,field_id:f.id,file_path:path,file_name:file.name});
          }
        }
        await supabase.from("submissions").insert({
          id:submissionId, gift_id:gift.id, template_id:template.id,
          customer_name:Object.values(values)[0]||"Customer", status:"New",
          ...(payment ? { razorpay_payment_id:payment.razorpay_payment_id, payment_status:payment.payment_status } : (hasPayment ? {} : { payment_status:"not_required" }))
        });
        if(rows.length) await supabase.from("submission_values").insert(rows);
        if(fileRecords.length) await supabase.from("submission_files").insert(fileRecords);
      } catch(e){ console.warn(e); }
    }
    const localSubmission={id:submissionId,customer_name:Object.values(values)[0]||"Customer",gift_name:gift.name,template_name:template.name,created_at:new Date().toISOString(),status:"New",values:Object.fromEntries(sections.flatMap(s=>s.fields||[]).map(f=>[f.label,values[f.id]])),files};
    setData(d=>({...d,submissions:[localSubmission,...d.submissions]}));
    setBusy(false);setDone(true);
  }

  const accentColor = (THEMES.find(t=>t[0]===(data.settings?.theme||"theme-1"))||THEMES[0])[2];

  if(done) return <div className="user-shell" style={{"--accent":accentColor}}><div className="success-screen"><div className="success-mark"><Check/></div><h1>Details submitted successfully!</h1><p>Your surprise details are safely recorded.</p><button className="primary" onClick={()=>{setDone(false);setStep(1);setGift(null);setTemplate(null);setValues({});setFiles({})}}>Submit another</button></div><ContactFooter settings={data.settings}/></div>;

  return <div className="user-shell" style={{"--accent":accentColor}}>
    <header className="user-header"><div className="brand"><span className="brand-mark">S</span><span>Surprizyy</span></div><button className="admin-link" onClick={()=>navigate("/admin")}>Admin</button></header>
    <div className="user-container">
      <div className="user-hero"><span className="eyebrow">PERSONALIZED DIGITAL GIFT</span><h1>Let's create something special.</h1><p>Choose a surprise and share the details. It only takes a minute.</p></div>
      <div className="steps"><span className={step>=1?"current":""}>1 <b>Gift</b></span><i></i><span className={step>=2?"current":""}>2 <b>Template</b></span><i></i><span className={step>=3?"current":""}>3 <b>Preview</b></span><i></i><span className={step>=4?"current":""}>4 <b>Details</b></span>{hasPayment && <><i></i><span className={step>=5?"current":""}>5 <b>Payment</b></span></>}</div>

      {step===1 && <div className="selection-grid">{activeGifts.map(g=><button className="choice-card" key={g.id} onClick={()=>selectGift(g)}><span>{g.emoji}</span><strong>{g.name}</strong><small>Choose {g.name.toLowerCase()} surprise</small></button>)}</div>}
      {step===2 && <><button className="back-button" onClick={()=>setStep(1)}><ArrowLeft/>Back</button><h2>Choose a template</h2><div className="selection-grid">{templates.map(t=><button className="choice-card template-choice" key={t.id} onClick={()=>selectTemplate(t)}><div className="template-mini">{(t.preview_urls?.[0]||t.preview_url)?<img src={t.preview_urls?.[0]||t.preview_url} alt=""/>:<LayoutTemplate/>}</div><strong>{t.name}</strong>{!!t.price && <small className="card-price">{t.discount_percentage>0 ? <>₹{finalPrice(t)} <s>₹{t.price}</s></> : `₹${t.price}`}</small>}</button>)}</div></>}
      {step===3 && template && <><button className="back-button" onClick={()=>setStep(2)}><ArrowLeft/>Back</button>
        <div className="product-preview-layout">
          <ImageGallery images={template.preview_urls?.length ? template.preview_urls : [template.preview_url]} name={template.name}/>
          <div className="preview-info">
            <h2>{template.name}</h2>
            {!!template.price && <div className="price-tag preview-price">{template.discount_percentage>0 ? <>₹{finalPrice(template)} <s>₹{template.price}</s> <em className="discount-badge">{template.discount_percentage}% OFF</em></> : `₹${template.price}`}</div>}
            <p className="muted-text">{template.description||"No description added yet."}</p>
            <button className="primary" onClick={()=>setStep(4)}>Continue to Form <ArrowLeft size={17} style={{transform:"rotate(180deg)"}}/></button>
          </div>
        </div>
      </>}
      {step===4 && <><button className="back-button" onClick={()=>setStep(3)}><ArrowLeft/>Back</button><h2>{template.name}</h2><p className="muted-text">Fill in the details below.</p>
        <div className="dynamic-form">{sections.map(s=><div className="user-section" key={s.id}><h3>{s.title}</h3>{s.fields?.filter(f=>f.active).sort((a,b)=>a.sort_order-b.sort_order).map(f=><DynamicField key={f.id} field={f} value={values[f.id]} files={files[f.id]||[]} setValue={v=>setVal(f.id,v)} setFiles={v=>setFiles(x=>({...x,[f.id]:v}))}/>)}</div>)}
        <button className="primary submit" disabled={busy} onClick={proceedFromDetails}>{busy?"Please wait...":(hasPayment?"Continue to Payment":"Submit My Details")} <Save size={17}/></button></div>
      </>}
      {step===5 && template && <><button className="back-button" onClick={()=>setStep(4)}><ArrowLeft/>Back</button><h2>Payment</h2><p className="muted-text">Complete payment to submit your order.</p>
        <div className="payment-summary">
          <div className="payment-row"><span>{template.name}</span><strong>₹{amount}</strong></div>
          {template.discount_percentage>0 && <div className="payment-row muted"><span><s>₹{template.price}</s> ({template.discount_percentage}% off applied)</span></div>}
        </div>
        {razorpayKeyId
          ? <button className="primary submit" disabled={busy} onClick={payNow}>{busy?"Opening payment...":`Pay ₹${amount}`} <Save size={17}/></button>
          : <p className="payment-note">Payments aren't set up yet on this site. Please contact the site owner to complete your order.</p>}
      </>}
    </div>
    <ContactFooter settings={data.settings}/>
  </div>
}

function ContactFooter({settings}) {
  const wa = (settings?.whatsapp_number||"").replace(/[^0-9]/g,"");
  const ig = settings?.instagram_url;
  if (!wa && !ig) return null;
  return (
    <>
      {wa && <a className="wa-float" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><MessageCircle size={24}/></a>}
      <div className="contact-strip">
        {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={24}/></a>}
        {ig && <a href={ig} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={24}/></a>}
      </div>
    </>
  );
}

function ImageGallery({images, name}) {
  const imgs = (images||[]).filter(Boolean).slice(0,4);
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);

  if (!imgs.length) return <div className="preview-gallery"><div className="gallery-main empty"><LayoutTemplate size={48}/></div></div>;

  function prev(){ setIdx(i => (i-1+imgs.length)%imgs.length); }
  function next(){ setIdx(i => (i+1)%imgs.length); }
  function onTouchStart(e){ touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e){
    if (touchStartX.current===null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 40) prev();
    else if (dx < -40) next();
    touchStartX.current = null;
  }

  return (
    <div className="preview-gallery">
      <div className="gallery-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img src={imgs[idx]} alt={name} />
        {imgs.length>1 && <>
          <button className="gallery-arrow left" onClick={prev} aria-label="Previous photo"><ArrowLeft size={18}/></button>
          <button className="gallery-arrow right" onClick={next} aria-label="Next photo"><ArrowLeft size={18} style={{transform:"rotate(180deg)"}}/></button>
        </>}
      </div>
      {imgs.length>1 && <div className="gallery-dots">{imgs.map((_,i)=><button key={i} className={i===idx?"active":""} onClick={()=>setIdx(i)} aria-label={`Photo ${i+1}`}/>)}</div>}
    </div>
  );
}

function DynamicField({field,value,files,setValue,setFiles}) {
  const common={required:field.required};
  const helper = field.helper_text ? <small className="field-helper">{field.helper_text}</small> : null;
  if(field.type==="textarea") return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<textarea {...common} value={value||""} placeholder={field.placeholder} onChange={e=>setValue(e.target.value)}/></label>;
  if(field.type==="select") return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<select {...common} value={value||""} onChange={e=>setValue(e.target.value)}><option value="">Choose...</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
  if(field.type==="radio") return <fieldset className="form-field"><legend>{field.label}{field.required&&<em>*</em>}</legend>{helper}<div className="options">{(field.options||[]).map(o=><label key={o}><input type="radio" name={field.id} checked={value===o} onChange={()=>setValue(o)}/>{o}</label>)}</div></fieldset>;
  if(field.type==="checkbox") return <label className="check-field"><input type="checkbox" checked={!!value} onChange={e=>setValue(e.target.checked)}/><span>{field.label}</span>{helper}</label>;
  if(field.type==="date") return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<input type="date" {...common} value={value||""} onChange={e=>setValue(e.target.value)}/></label>;
  if(field.type==="number") return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<input type="number" {...common} value={value||""} placeholder={field.placeholder} onChange={e=>setValue(e.target.value)}/></label>;
  if(field.type==="country") return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<select {...common} value={value||""} onChange={e=>setValue(e.target.value)}><option value="">Choose a country...</option>{COUNTRIES.map(([name])=><option key={name} value={name}>{name}</option>)}</select></label>;
  if(field.type==="phone") {
    const code = value?.code || "+91", number = value?.number || "";
    return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}
      <div className="phone-field">
        <select value={code} onChange={e=>setValue({code:e.target.value, number})}>{COUNTRIES.map(([name,dial])=><option key={name+dial} value={dial}>{dial} {name}</option>)}</select>
        <input type="tel" placeholder={field.placeholder||"Mobile number"} value={number} onChange={e=>setValue({code, number:e.target.value.replace(/[^0-9]/g,"")})}/>
      </div>
    </label>;
  }
  if(field.type==="image"||field.type==="images") return <ImageUpload field={field} files={files} setFiles={setFiles}/>;
  return <label className="form-field"><span>{field.label}{field.required&&<em>*</em>}</span>{helper}<input {...common} value={value||""} placeholder={field.placeholder} onChange={e=>setValue(e.target.value)}/></label>;
}

function ImageUpload({field,files,setFiles}) {
  function add(e){const incoming=[...e.target.files];const max=field.type==="image"?1:(field.max_files||5);setFiles([...files,...incoming].slice(0,max));}
  return <div className="upload-field"><span>{field.label}{field.required&&<em>*</em>}</span><label className="dropzone"><Upload/><strong>Choose {field.type==="image"?"an image":"images"}</strong><small>PNG, JPG, WEBP</small><input type="file" accept="image/*" multiple={field.type==="images"} onChange={add}/></label>
    {!!files.length&&<div className="thumbs">{files.map((f,i)=><div className="thumb" key={i}><img src={URL.createObjectURL(f)} alt=""/><button onClick={()=>setFiles(files.filter((_,j)=>j!==i))}><X size={13}/></button></div>)}</div>}
  </div>
}

function Empty({title,text,action}){return <div className="empty"><div className="empty-icon"><FileText/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="primary" onClick={action}><Plus/>Add</button>}</div>}

function Modal({title,children,onClose,onSave,saveLabel="Save changes"}) {
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X/></button></div><div className="modal-body">{children}</div><div className="modal-foot"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={onSave}><Save/> {saveLabel}</button></div></div></div>
}
function GiftModal({value,onClose,onSave}){const [v,setV]=useState(value);return <Modal title="Edit gift type" onClose={onClose} onSave={()=>onSave(v)}><div className="modal-form"><label>Name<input value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label><label>Emoji<input value={v.emoji||""} onChange={e=>setV({...v,emoji:e.target.value})}/></label><label className="switch-row">Active<input type="checkbox" checked={v.active} onChange={e=>setV({...v,active:e.target.checked})}/></label></div></Modal>}
function TemplateModal({value,onClose,onSave}){
  const [v,setV]=useState({...value, preview_urls: value.preview_urls?.length ? [...value.preview_urls] : (value.preview_url ? [value.preview_url] : [])});
  const [uploading,setUploading]=useState({});
  function setImg(i,val){ setV(x=>{ const arr=[...(x.preview_urls||[])]; arr[i]=val; return {...x, preview_urls:arr}; }); }

  async function uploadPhoto(i, file){
    if (!supabase) { alert("Connect Supabase (fill in your .env) to enable photo uploads."); return; }
    setUploading(u=>({...u,[i]:true}));
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `templates/${v.id}/${i}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("template-images").upload(path, file, { upsert:true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("template-images").getPublicUrl(path);
      setImg(i, pub.publicUrl);
    } catch(e) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setUploading(u=>({...u,[i]:false}));
    }
  }

  function handleSave(){
    const cleaned = (v.preview_urls||[]).map(u=>(u||"").trim()).filter(Boolean).slice(0,4);
    onSave({...v, preview_urls:cleaned, preview_url:cleaned[0]||""});
  }

  return <Modal title="Edit template" onClose={onClose} onSave={handleSave}><div className="modal-form">
    <label>Name<input value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label>
    <label>Description<textarea value={v.description||""} onChange={e=>setV({...v,description:e.target.value})}/></label>
    <label>Price (₹)<input type="number" min="0" step="0.01" value={v.price??0} onChange={e=>setV({...v,price:Number(e.target.value)})}/></label>
    <label>Discount (%)<input type="number" min="0" max="100" step="1" value={v.discount_percentage??0} onChange={e=>setV({...v,discount_percentage:Number(e.target.value)})}/></label>
    <span className="photo-upload-heading">Photos (tap a box to upload)</span>
    <div className="photo-upload-grid">
      {[0,1,2,3].map(i=>
        <div className="photo-upload-slot" key={i}>
          <label className="photo-upload-box">
            {v.preview_urls?.[i] ? <img src={v.preview_urls[i]} alt=""/> : <Upload size={20}/>}
            {uploading[i] && <div className="photo-upload-overlay">Uploading…</div>}
            <input type="file" accept="image/*" hidden disabled={uploading[i]} onChange={e=>{const f=e.target.files[0]; if(f) uploadPhoto(i,f); e.target.value="";}}/>
          </label>
          <div className="photo-upload-foot">
            <span>{i===0 ? "Main photo" : `Photo ${i+1}`}</span>
            {v.preview_urls?.[i] && <button type="button" className="photo-remove" onClick={()=>setImg(i,"")}><X size={12}/></button>}
          </div>
        </div>
      )}
    </div>
    <label className="switch-row">Active<input type="checkbox" checked={v.active} onChange={e=>setV({...v,active:e.target.checked})}/></label>
  </div></Modal>
}
function SectionModal({value,onClose,onSave}){const [v,setV]=useState(value);return <Modal title="Edit section" onClose={onClose} onSave={()=>onSave(v)}><div className="modal-form"><label>Section title<input value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label><label className="switch-row">Visible to users<input type="checkbox" checked={v.active} onChange={e=>setV({...v,active:e.target.checked})}/></label></div></Modal>}
function FieldModal({value,onClose,onSave}){const [v,setV]=useState({...value,options:(value.options||[]).join("\n")});const types=[["text","Text"],["textarea","Long message"],["image","Photo"],["images","Multiple photos"],["date","Date"],["select","Dropdown"],["radio","Radio buttons"],["checkbox","Checkbox"],["number","Number"],["country","Country"],["phone","Mobile number"]];return <Modal title="Edit field" onClose={onClose} onSave={()=>onSave({...v,options:String(v.options||"").split("\n").map(x=>x.trim()).filter(Boolean)})}><div className="modal-form"><label>Field type<select value={v.type} onChange={e=>setV({...v,type:e.target.value})}>{types.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label><label>Label<input value={v.label} onChange={e=>setV({...v,label:e.target.value})}/></label><label>Example / helper text<input value={v.helper_text||""} onChange={e=>setV({...v,helper_text:e.target.value})} placeholder="e.g. Song title, Instagram link"/></label>{!["image","images","checkbox","country","phone"].includes(v.type)&&<label>Placeholder<input value={v.placeholder||""} onChange={e=>setV({...v,placeholder:e.target.value})}/></label>}{["select","radio"].includes(v.type)&&<label>Options (one per line)<textarea value={v.options||""} onChange={e=>setV({...v,options:e.target.value})}/></label>}{v.type==="images"&&<label>Maximum photos<input type="number" min="1" max="50" value={v.max_files||5} onChange={e=>setV({...v,max_files:Number(e.target.value)})}/></label>}<label className="switch-row">Required<input type="checkbox" checked={v.required} onChange={e=>setV({...v,required:e.target.checked})}/></label><label className="switch-row">Visible to users<input type="checkbox" checked={v.active} onChange={e=>setV({...v,active:e.target.checked})}/></label></div></Modal>}
function SubmissionModal({submission,onClose}){
  const localImages = Object.values(submission.files||{}).flat().map(f=>({name:f.name, url:URL.createObjectURL(f)}));
  const remoteImages = (submission.images||[]).filter(f=>f.url);
  const images = localImages.length ? localImages : remoteImages;
  return <Modal title="Submission details" onClose={onClose} onSave={onClose} saveLabel="Close"><div className="submission-detail"><div className="detail-grid"><div><small>Customer</small><strong>{submission.customer_name||"—"}</strong></div><div><small>Gift</small><strong>{submission.gift_name||"—"}</strong></div><div><small>Template</small><strong>{submission.template_name||"—"}</strong></div><div><small>Submitted</small><strong>{submission.created_at?new Date(submission.created_at).toLocaleString():"—"}</strong></div></div><h3>Answers</h3>{Object.entries(submission.values||{}).map(([k,v])=><div className="answer" key={k}><span>{k}</span><p>{typeof v==="boolean"?(v?"Yes":"No"):(v&&typeof v==="object"?`${v.code||""} ${v.number||""}`.trim():(v||"—"))}</p></div>)}<h3>Images</h3><div className="detail-images">{images.length ? images.map((f,i)=><div className="detail-img" key={i}><img src={f.url} alt=""/><a href={f.url} download={f.name} target="_blank" rel="noreferrer"><Download size={15}/></a></div>) : <p className="muted-text">No images.</p>}</div></div></Modal>}

createRoot(document.getElementById("root")).render(<App />);