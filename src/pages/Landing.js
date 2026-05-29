import { Link } from 'react-router-dom';
import AuthSplitShell from '../components/AuthSplitShell';

function Landing() {
  return (
    <AuthSplitShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-3">
        <Link
          to="/signup"
          className="flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[#111111] text-center text-[15px] font-medium tracking-wide text-white transition hover:bg-[#222222] active:scale-[0.99]"
        >
          Create an account
        </Link>
        <Link
          to="/signin"
          className="flex h-[50px] w-full items-center justify-center rounded-[12px] border border-[#111111] bg-white text-center text-[15px] font-medium tracking-wide text-ink transition hover:bg-surface active:scale-[0.99]"
        >
          Sign in
        </Link>
      </div>
    </AuthSplitShell>
  );
}

export default Landing;
