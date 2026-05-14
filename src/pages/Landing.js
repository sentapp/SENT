import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-[#F9F7F2] md:items-center md:justify-center md:p-8">
      <main className="mx-auto flex w-full max-w-mobile flex-1 flex-col px-6 py-12 md:max-w-[480px] md:flex-none md:justify-center md:py-16">
        <div className="mb-auto flex flex-1 flex-col items-center justify-start pt-[max(8vh,2rem)] md:mb-0 md:flex-none md:justify-center md:pt-0 md:self-stretch">
          <div className="flex flex-col items-center text-center">
            <p className="sent-section-label mb-3">Missionary CRM</p>
            <h1 className="sent-logo">SENT</h1>
            <p className="mx-auto mt-6 max-w-[22rem] text-pretty font-sans text-[13px] leading-relaxed text-[#9C8C78] md:max-w-md">
              For missionaries and the people who send them.
            </p>
          </div>

          <div className="mt-16 w-full max-w-md space-y-3 md:mt-20">
            <Link
              to="/signup"
              className="flex h-[50px] w-full items-center justify-center rounded-md bg-[#181208] text-center text-[15px] font-medium text-[#F9F7F2] transition duration-200 ease-out hover:bg-[#181208]/90 active:scale-[0.99]"
            >
              Create an account
            </Link>
            <Link
              to="/signin"
              className="flex h-[50px] w-full items-center justify-center rounded-md border-[0.5px] border-[#181208] bg-transparent text-center text-[15px] font-medium text-[#181208] transition duration-200 ease-out hover:bg-[#F2EDE4]/80 active:scale-[0.99]"
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
