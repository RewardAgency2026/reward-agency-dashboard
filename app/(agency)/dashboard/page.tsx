import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome to Reward Agency Dashboard
      </h1>
      <p className="text-gray-500">
        Hello, <span className="font-medium text-gray-700">{session?.user.name}</span>. You are
        logged in as <span className="font-medium text-gray-700 capitalize">{session?.user.role}</span>.
      </p>
    </div>
  );
}
