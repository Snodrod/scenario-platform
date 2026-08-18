import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { NewProjectForm } from "@/components/NewProjectForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <Header email={user?.email} />
      <main className="mx-auto max-w-5xl px-4 py-8 flex-1 w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-neutral-100">Проекты</h1>
        </div>

        <div className="mb-8">
          <NewProjectForm />
        </div>

        {!projects?.length ? (
          <p className="text-sm text-neutral-500">
            Пока нет проектов — создайте первый, чтобы вставить сценарий и получить раскадровку.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 transition-colors"
                >
                  <div className="font-medium text-neutral-100">{project.name}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {project.format === "short" ? "Короткий ролик" : "Длинный ролик"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
