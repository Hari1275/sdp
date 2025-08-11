import { filterNavByRole, isPathAllowed, navigation } from "../navigation-config";

describe("navigation-config", () => {
  test("ADMIN sees all items", () => {
    const items = filterNavByRole("ADMIN");
    // Every nav item should include ADMIN
    expect(items.length).toBe(navigation.length);
    for (const item of items) {
      expect(item.roles).toContain("ADMIN");
    }
  });

  test("LEAD_MR sees only allowed items", () => {
    const items = filterNavByRole("LEAD_MR");
    // Lead MR should not see strictly ADMIN-only pages like users/regions/clients
    const names = items.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["Dashboard", "Tasks", "Reports", "Tracking"]));
    expect(names).not.toEqual(expect.arrayContaining(["User Management", "Regions & Areas", "Clients"]));
  });

  test("path access control works for LEAD_MR", () => {
    expect(isPathAllowed("/admin", "LEAD_MR")).toBe(true);
    expect(isPathAllowed("/admin/tracking", "LEAD_MR")).toBe(true);
    expect(isPathAllowed("/admin/users", "LEAD_MR")).toBe(false);
    expect(isPathAllowed("/admin/regions", "LEAD_MR")).toBe(false);
  });
});


