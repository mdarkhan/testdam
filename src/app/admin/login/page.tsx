import { redirect } from "next/navigation";
import { ActionForm, Field, SubmitButton } from "@/components/admin/form";
import { getUser } from "@/lib/auth";
import { signIn } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getUser()) redirect("/admin");
  return (
    <main className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="text-xl font-semibold">Test Mate admin</h1>
      <ActionForm action={signIn} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="username" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton>Sign in</SubmitButton>
      </ActionForm>
    </main>
  );
}
