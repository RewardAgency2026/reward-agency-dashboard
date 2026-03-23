import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Reward Agency Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session.user.name} &middot;{" "}
            <span className="capitalize font-medium">{session.user.role}</span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="px-6 py-10 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to Reward Agency Dashboard
          </h2>
          <p className="text-gray-600">
            Hello, <span className="font-medium">{session.user.name}</span>! You are logged in as{" "}
            <span className="font-medium capitalize">{session.user.role}</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
