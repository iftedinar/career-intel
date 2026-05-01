import { useState } from "react";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";

function Code({ children }) {
  const [ok, setOk] = useState(false);
  return (
    <div style={{ position:"relative", marginTop:6 }}>
      <div className="code">{children}</div>
      <button className="btn ghost ico xs" style={{ position:"absolute", top:5, right:5 }}
        onClick={() => { navigator.clipboard.writeText(children); setOk(true); setTimeout(()=>setOk(false),2000); }}>
        {ok ? <CheckCircle size={11} style={{color:"var(--green)"}}/> : <Copy size={11}/>}
      </button>
    </div>
  );
}

function S({ n, title, children }) {
  return (
    <div className="step">
      <div className="step-n">{n}</div>
      <div className="step-b">
        <div className="step-t">{title}</div>
        <div className="step-d">{children}</div>
      </div>
    </div>
  );
}

function A({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" className="hl" style={{textDecoration:"underline"}}>{children}</a>;
}

export default function DeployPage() {
  const [tab, setTab] = useState("github");

  return (
    <div className="page si">
      <div className="ph">
        <div>
          <div className="ph-title">Deploy guide</div>
          <div className="ph-sub">Get Career Intel live on the web — step by step</div>
        </div>
      </div>

      <div className="tabs" style={{ maxWidth:460 }}>
        <button className={`tab ${tab==="github"?"on":""}`} onClick={()=>setTab("github")}>1 · GitHub</button>
        <button className={`tab ${tab==="railway"?"on":""}`} onClick={()=>setTab("railway")}>2 · Railway</button>
        <button className={`tab ${tab==="vercel"?"on":""}`} onClick={()=>setTab("vercel")}>3 · Vercel</button>
      </div>

      {tab === "github" && (
        <div>
          <div className="al i" style={{marginBottom:"1.25rem"}}>
            GitHub stores your code. Railway (backend) and Vercel (frontend) both pull from it automatically.
          </div>

          <S n="1" title="Create a free GitHub account">
            Go to <A href="https://github.com/signup">github.com/signup</A> if you don't have one.
          </S>

          <S n="2" title="Create a new repository">
            Click the <strong style={{color:"var(--tx)"}}>+</strong> in the top right → New repository.<br/>
            Name it <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel</code> · set to Public · click <strong style={{color:"var(--tx)"}}>Create repository</strong>.
          </S>

          <S n="3" title="Install Git on your computer">
            Download from <A href="https://git-scm.com/downloads">git-scm.com/downloads</A> and install.
          </S>

          <S n="4" title="Upload the project">
            Open Terminal (Mac) or Command Prompt (Windows). Run:
            <Code>{`cd path/to/career-intel-final

git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/career-intel.git
git push -u origin main`}</Code>
            Replace <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>YOUR-USERNAME</code> with your GitHub username.
          </S>

          <S n="5" title="Verify">
            Go to <A href="https://github.com">github.com</A> → your profile → you should see the <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel</code> repo with all files inside.
          </S>

          <div style={{marginTop:"1.5rem", padding:"1rem", background:"var(--bg3)", borderRadius:"var(--rl)"}}>
            <div style={{fontSize:".8rem", color:"var(--tx2)", lineHeight:1.7}}>
              ✅ Done with GitHub? Click <strong style={{color:"var(--tx)"}}>2 · Railway</strong> above.
            </div>
          </div>
        </div>
      )}

      {tab === "railway" && (
        <div>
          <div className="al i" style={{marginBottom:"1.25rem"}}>
            Railway runs the backend (the part that talks to Claude AI). Free tier is plenty for personal use.
          </div>

          <S n="1" title="Get your Anthropic API key">
            Go to <A href="https://console.anthropic.com">console.anthropic.com</A> → sign up (free) → API Keys → Create key.<br/>
            Copy it — it looks like <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>sk-ant-api03-...</code>
          </S>

          <S n="2" title="Create a Railway account">
            Go to <A href="https://railway.app">railway.app</A> → Sign in with GitHub.
          </S>

          <S n="3" title="Create a new project">
            Click <strong style={{color:"var(--tx)"}}>New Project</strong> → <strong style={{color:"var(--tx)"}}>Deploy from GitHub repo</strong> → select <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel</code>.
          </S>

          <S n="4" title="Add your API key">
            In your Railway project → click the service → <strong style={{color:"var(--tx)"}}>Variables</strong> tab → <strong style={{color:"var(--tx)"}}>Add Variable</strong>:
            <Code>{`ANTHROPIC_API_KEY = sk-ant-your-key-here`}</Code>
            Click <strong style={{color:"var(--tx)"}}>Deploy</strong>. Wait ~60 seconds for it to build.
          </S>

          <S n="5" title="Copy your Railway URL">
            In Railway → your service → <strong style={{color:"var(--tx)"}}>Settings</strong> → <strong style={{color:"var(--tx)"}}>Networking</strong> → Generate Domain.<br/>
            You'll get a URL like: <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel-production.up.railway.app</code><br/>
            <strong style={{color:"var(--tx)"}}>Copy this — you need it in the next step.</strong>
          </S>

          <S n="6" title="Test it">
            Open your Railway URL + <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>/api/health</code> in your browser.<br/>
            You should see: <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>{"{"}"status":"ok"{"}"}</code>
          </S>

          <div style={{marginTop:"1.5rem", padding:"1rem", background:"var(--bg3)", borderRadius:"var(--rl)"}}>
            <div style={{fontSize:".8rem", color:"var(--tx2)", lineHeight:1.7}}>
              ✅ Backend is live! Click <strong style={{color:"var(--tx)"}}>3 · Vercel</strong> above to deploy the frontend.
            </div>
          </div>
        </div>
      )}

      {tab === "vercel" && (
        <div>
          <div className="al i" style={{marginBottom:"1.25rem"}}>
            Vercel hosts the frontend (the website you see). It connects to your Railway backend automatically.
          </div>

          <S n="1" title="Create a Vercel account">
            Go to <A href="https://vercel.com">vercel.com</A> → Sign up with GitHub.
          </S>

          <S n="2" title="Import your project">
            Click <strong style={{color:"var(--tx)"}}>Add New → Project</strong> → select your <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel</code> GitHub repo → click <strong style={{color:"var(--tx)"}}>Import</strong>.
          </S>

          <S n="3" title="Update vercel.json with your Railway URL">
            Before deploying, open <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>vercel.json</code> in your project and replace <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>YOUR-APP</code> with your actual Railway domain:
            <Code>{`"destination": "https://career-intel-production.up.railway.app/api/:path*"`}</Code>
            Save → push to GitHub:
            <Code>{`git add vercel.json
git commit -m "add railway url"
git push`}</Code>
          </S>

          <S n="4" title="Deploy on Vercel">
            Back in Vercel → click <strong style={{color:"var(--tx)"}}>Deploy</strong>.<br/>
            Framework: <strong style={{color:"var(--tx)"}}>Vite</strong> (auto-detected).<br/>
            Build command: <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>npm run build</code><br/>
            Output directory: <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>dist</code>
          </S>

          <S n="5" title="Your app is live!">
            Vercel gives you a URL like <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>career-intel-xyz.vercel.app</code>.<br/>
            Open it → upload your resume → click Refresh → done. 🎉
          </S>

          <S n="6" title="Future updates">
            Every time you change code and run <code style={{fontFamily:"var(--mono)",color:"var(--amber)",fontSize:".78rem"}}>git push</code>, Vercel and Railway both redeploy automatically.
          </S>

          <div className="card" style={{marginTop:"1.5rem", background:"var(--bg3)"}}>
            <div style={{fontSize:".82rem", color:"var(--tx2)", lineHeight:1.75}}>
              <strong style={{color:"var(--tx)"}}>💰 Cost estimate</strong><br/>
              Railway free tier: $5 free credit/month (more than enough for personal use)<br/>
              Vercel free tier: unlimited hobby projects<br/>
              Anthropic API: ~$0.04 per Refresh · $5 credit lasts 100+ refreshes<br/>
              <strong style={{color:"var(--green)"}}>Effective cost: nearly free</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
