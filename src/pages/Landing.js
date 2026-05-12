import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-background md:items-center md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col px-6 py-12 md:max-w-[480px] md:flex-none md:justify-center md:py-16">
        <div className="mb-auto flex flex-1 flex-col items-center justify-start pt-[max(8vh,2rem)] md:mb-0 md:flex-none md:justify-center md:pt-0 md:self-stretch">
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 text-2xl leading-none text-[#C2410C]" aria-hidden>
              ✦
            </span>
            <h1 className="text-[clamp(3.5rem,18vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.06em] text-mission-ink">
              SENT
            </h1>
            <p className="sent-body mx-auto mt-8 max-w-[22rem] text-pretty text-mission-muted md:max-w-md">
              For missionaries and the people who send them.
            </p>
          </div>

          <div className="mt-16 w-full max-w-md space-y-3 md:mt-20">
            <Link
              to="/signup"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-mission-ink text-center text-[15px] font-medium text-white transition duration-200 ease-out hover:bg-mission-ink/90 active:scale-[0.99]"
            >
              Create an account
            </Link>
            <Link
              to="/signin"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] border border-mission-ink bg-transparent text-center text-[15px] font-medium text-mission-ink transition duration-200 ease-out hover:bg-white/60 active:scale-[0.99]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Landing;
