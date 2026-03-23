import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user.name ?? "";
  const role = session?.user.role ?? "";

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        Welcome to Reward Agency Dashboard
      </h1>
      <p className="text-gray-500">
        Hello, <span className="font-medium text-gray-700">{name}</span>. You are logged in as{" "}
        <span className="font-medium capitalize text-gray-700">{role}</span>.
      </p>
    </div>
  );
}
