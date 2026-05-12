import { Link } from 'react-router-dom';

function IconCrossStar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v16M8 12h8"
        stroke="#185FA5"
        strokeOpacity={0.35}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        fill="#185FA5"
        d="M12 2.2l.95 2.9h3.05l-2.45 1.8.95 2.9L12 8l-2.5 1.8.95-2.9-2.45-1.8h3.05L12 2.2z"
      />
    </svg>
  );
}

function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-mission-canvas via-white to-white md:items-center md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col px-6 py-12 md:max-w-[480px] md:flex-none md:justify-center md:py-16">
        <div className="mb-auto flex flex-1 flex-col items-center justify-start pt-[max(10vh,2.5rem)] md:mb-0 md:flex-none md:justify-center md:pt-0 md:self-stretch">
          <div className="flex flex-col items-center text-center">
            <IconCrossStar className="mb-5 h-9 w-9" />
            <h1 className="text-[2.75rem] font-bold leading-none tracking-tight text-neutral-900 sm:text-5xl">SENT</h1>
            <p className="sent-body mx-auto mt-5 max-w-[20rem] text-pretty text-mission-muted md:max-w-none md:text-base">
              For missionaries and the people who send them.
            </p>
          </div>

          <div className="mt-14 w-full max-w-md space-y-3 md:mt-16">
            <Link
              to="/signup"
              className="block w-full rounded-btn bg-mission-blue py-3.5 text-center text-base font-medium text-white shadow-card transition hover:bg-mission-blue/95 active:scale-[0.99] active:bg-mission-blue/90"
            >
              Create an account
            </Link>
            <Link
              to="/signin"
              className="block w-full rounded-btn border border-mission-blue bg-white py-3.5 text-center text-base font-medium text-mission-blue shadow-card transition hover:bg-mission-blue/[0.06] active:scale-[0.99]"
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
