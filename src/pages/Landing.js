import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-white md:items-center md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col px-6 py-12 md:max-w-[480px] md:flex-none md:justify-center md:py-16">
        <div className="mb-auto flex flex-1 flex-col items-center justify-start pt-[max(8vh,2rem)] md:mb-0 md:flex-none md:justify-center md:pt-0 md:self-stretch">
          <div className="flex flex-col items-center text-center">
            <p className="sent-section-label mb-3">Missionary CRM</p>
            <h1 className="sent-logo">SENT</h1>
            <p className="mx-auto mt-6 max-w-[22rem] text-pretty font-sans text-[13px] leading-relaxed text-muted md:max-w-md">
              For missionaries and the people who send them.
            </p>
          </div>

          <div className="mt-16 w-full max-w-md space-y-3 md:mt-20">
            <Link
              to="/signup"
              className="flex h-[50px] w-full items-center justify-center rounded-lg bg-accent text-center text-[15px] font-medium text-white transition duration-200 ease-out hover:bg-accent/90 active:scale-[0.99]"
            >
              Create an account
            </Link>
            <Link
              to="/signin"
              className="flex h-[50px] w-full items-center justify-center rounded-lg border-[0.5px] border-[#EEEEEE] bg-white text-center text-[15px] font-medium text-ink transition duration-200 ease-out hover:bg-surface active:scale-[0.99]"
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
