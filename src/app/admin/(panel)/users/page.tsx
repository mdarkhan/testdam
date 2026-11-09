import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm, Field, Select, SubmitButton } from "@/components/admin/form";
import { addUser, updateUser } from "./actions";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUser("ADMIN");
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="text-sm text-muted">DATA_ENTRY can edit labs, tests, areas and prices. ADMIN can also manage users, delete records, mark medical text as reviewed and set featured labs.</p>

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="rounded-lg border border-line bg-white p-4">
            <p className="font-semibold">{u.name} <span className="font-normal text-muted">· {u.email}{u.id === me.id && " (you)"}</span></p>
            <ActionForm action={updateUser.bind(null, u.id)} className="mt-2">
              <div className="grid items-end gap-3 sm:grid-cols-3">
                <Select label="Role" name="role" defaultValue={u.role}>
                  <option value="DATA_ENTRY">DATA_ENTRY</option>
                  <option value="ADMIN">ADMIN</option>
                </Select>
                <Field label="New password" name="password" type="password" autoComplete="new-password" hint="Leave blank to keep" />
                <SubmitButton>Save</SubmitButton>
              </div>
            </ActionForm>
          </li>
        ))}
      </ul>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">Add user</h2>
        <ActionForm action={addUser} resetOnSuccess className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <Select label="Role" name="role" defaultValue="DATA_ENTRY">
              <option value="DATA_ENTRY">DATA_ENTRY</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
            <Field label="Password" name="password" type="password" autoComplete="new-password" required hint="At least 10 characters" />
          </div>
          <div className="mt-3"><SubmitButton>Add user</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}
