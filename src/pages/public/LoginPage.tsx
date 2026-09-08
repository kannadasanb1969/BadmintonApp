import LoginForm from '@/features/auth/components/LoginForm'
import { useNavigate } from 'react-router-dom'

const LoginPage = () => {
  const navigate = useNavigate()
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-8 lg:flex lg:items-center lg:justify-center">
      <div className="court-line court-line-one" />
      <div className="court-line court-line-two" />
      <div className="court-net" />
      <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="absolute left-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-3xl font-light text-white backdrop-blur transition hover:bg-white/20" aria-label="Go back">‹</button>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/40 backdrop-blur-sm lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative flex min-h-[350px] flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 p-7 sm:p-10 lg:min-h-[640px]">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-white/10" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full border-[34px] border-white/10" />
          <div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-xl shadow-lg">🏸</div><span className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-950/75">SmashPoint</span></div>
          <div className="relative py-12 lg:py-0"><p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-950/70">Tournament starts here</p><h1 className="max-w-md text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl">Own every rally.</h1><p className="mt-5 max-w-md text-base leading-7 text-emerald-50 sm:text-lg">Register, compete, and follow every score from your next badminton tournament.</p></div>
          <div className="relative flex items-center gap-3 text-sm text-emerald-50"><span className="h-2.5 w-2.5 rounded-full bg-lime-300 shadow-[0_0_18px_4px_rgba(190,242,100,.65)]" />Courts are open. Let’s play.</div>
        </section>
        <section className="bg-white px-6 py-8 text-slate-900 sm:px-10 sm:py-12"><LoginForm /></section>
      </div>
    </main>
  )
}

export default LoginPage
