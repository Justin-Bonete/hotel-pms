import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';

export function AuthShell({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  if (embedded) {
    return (
      <>
        <style>{`
          html,body{height:auto!important;min-height:100%!important;background:transparent!important}
          body{margin:0!important}
          .embedded-auth-shell{box-sizing:border-box;min-height:100dvh!important;padding:58px 18px 18px!important}
          .embedded-auth-brand{margin-bottom:14px!important}
          .embedded-auth-brand>div{background:#c9a45c!important;color:#071a20!important;box-shadow:0 8px 24px #c9a45c30}
          .embedded-auth-card{padding:22px!important;border:1px solid #c9a45c3d!important;border-radius:18px!important;background:linear-gradient(145deg,#12343cF5,#0a2229F7)!important;color:#e9efe9!important;box-shadow:0 24px 70px #0008, inset 0 1px #e9efe910!important}
          .embedded-auth-card h1{color:#f5eee1!important;letter-spacing:-.02em}
          .embedded-auth-card p{color:#b3c6c4!important}
          .embedded-auth-card label{color:#dce5df!important}
          .embedded-auth-card input{border:1px solid #e9efe928!important;background:#071a20b8!important;color:#f5eee1!important;box-shadow:inset 0 1px 2px #0003!important}
          .embedded-auth-card input::placeholder{color:#9ab0ae!important}
          .embedded-auth-card input:focus{outline:2px solid #c9a45c!important;outline-offset:1px}
          .embedded-auth-card button[type=submit]{background:#c9a45c!important;color:#1b1608!important;box-shadow:0 8px 24px #c9a45c24!important;transition:transform .2s ease,background .2s ease,box-shadow .2s ease}
          .embedded-auth-card button[type=submit]:hover{background:#dfbd79!important;transform:translateY(-1px);box-shadow:0 12px 30px #c9a45c38!important}
          .embedded-auth-card a{color:#d8b56c!important}
          .embedded-auth-card a:hover{color:#f1d89f!important}
          .embedded-auth-card form{display:flex;flex-direction:column;gap:12px!important}
          .embedded-auth-card form>*+*{margin-top:0!important}
          .embedded-auth-card input{padding-top:9px!important;padding-bottom:9px!important}
          @media(max-height:650px){
            .embedded-auth-shell{padding-top:52px!important;padding-bottom:12px!important}
            .embedded-auth-brand{display:none!important}
            .embedded-auth-card{padding:18px!important}
            .embedded-auth-card form{gap:9px!important}
          }
          @media(max-width:420px){
            .embedded-auth-shell{padding-left:12px!important;padding-right:12px!important}
            .embedded-auth-card{padding:18px!important}
          }
        `}</style>
        <div className="embedded-auth-shell flex flex-col items-center justify-center">
          <div className="embedded-auth-brand mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">PMS</div>
            <span className="text-lg font-semibold text-white">{APP_NAME}</span>
          </div>
          <div className="embedded-auth-card w-full max-w-md rounded-2xl bg-white/[0.97] p-7 shadow-2xl ring-1 ring-white/40 backdrop-blur-xl sm:p-8">{children}</div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">PMS</div>
        <span className="text-lg font-semibold text-slate-900">{APP_NAME}</span>
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">{children}</div>
    </div>
  );
}
