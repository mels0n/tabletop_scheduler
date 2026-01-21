# Finding 02: Semantic Schema Audit

## Status: 🟡 Focused Gaps Found

### 1. Event Schema (User Content)
**Verdict:** 🛑 **Do Not Implement**.
**Rationale:** We do not want user events indexed. Injecting `Event` schema would encourage Google to display them in rich results, which violates our privacy-first stance.
**Validation:** Ensure `app/e/[slug]/page.tsx` has `noindex` header references if not already present (or relies on sitemap exclusion).

### 2. Marketing Schema (Product Content)
**Finding:** `layout.tsx` has valid `SoftwareApplication` schema, but it is hardcoded JSON.
**Risk:** Fragile string injection.
**Fix Required:** Replace with type-safe `SchemaGenerator` implementation.

### 3. Breadcrumbs
**Finding:** No BreadcrumbList schema on informational pages (`/guide/...`).
**Impact:** Poor structure understanding for docs/guides.

## Action Plan
- [ ] Create `shared/lib/schema-generator.ts` (Type-safe).
- [ ] Refactor `layout.tsx` to use the generator.
- [ ] Inject `Breadcrumb` schema into /guide pages.
