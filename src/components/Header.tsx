import Link from "next/link";

export function Header({ email }: { email?: string | null }) {
  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-neutral-100">
          Scenario Platform
        </Link>
        {email && (
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span>{email}</span>
            <form action="/auth/signout" method="post">
              <button className="hover:text-neutral-100" type="submit">
                Выйти
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
