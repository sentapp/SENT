import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-white md:items-center md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col px-6 py-12 md:max-w-[480px] md:flex-none md:justify-center md:py-16">
        <div className="mb-auto flex flex-1 flex-col items-center justify-start pt-[max(12vh,3rem)] md:mb-0 md:flex-none md:pt-0 md:justify-center md:self-stretch md:text-center">
          <div className="mb-12">
            <h1 className="text-center text-3xl font-semibold tracking-tight text-neutral-900">
              SENT
            </h1>
            <div className="mx-auto mt-3 h-[3px] w-12 rounded-full bg-mission-blue" aria-hidden />
          </div>

          <p className="mb-auto max-w-sm text-center text-lg leading-relaxed text-neutral-600 md:mb-10 md:max-w-none">
            For missionaries and the people who send them.
          </p>

          <div className="mt-12 w-full space-y-4 md:mt-14">
            <Link
              to="/signup"
              className="block w-full rounded-btn bg-mission-blue py-4 text-center text-[17px] font-medium text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90"
            >
              Create an account
            </Link>
            <Link
              to="/signin"
              className="block w-full rounded-btn border-2 border-mission-blue bg-white py-[14px] text-center text-[17px] font-medium text-mission-blue transition-colors hover:bg-mission-blue/5 active:bg-mission-blue/10"
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
