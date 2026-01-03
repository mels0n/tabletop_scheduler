# Description

Please include a summary of the change and which issue is fixed.

Fixes # (issue)

## Deployment Mode Check (CRITICAL)

This project runs in two modes: **Hosted** (Public, AEO/SEO Heavy) and **Self-Hosted** (Private, Docker, No Tracking).
**You must ensure your changes respect the "Privacy vs Visibility" split.**

### 🌐 Hosted Mode (Public Web)
- [ ] My changes affect public pages (Start Page, Guides, Blog).
- [ ] I have updated the **Semantic Twin** content (FAQ/Guide) to match code changes.
- [ ] I have verified Schema.org/JSON-LD validity.
- [ ] I have checked `sitemap.ts` and `robots.txt` (if applicable).

### 🔒 Self-Hosted Mode (Docker / Private)
- [ ] My changes affect Docker, Environment Variables, or Core Logic.
- [ ] **SAFETY CHECK:** I have ensured NO AEO/SEO metadata leaks into the self-hosted build.
- [ ] **PRIVACY CHECK:** I have verified that `robots.txt` stays `Disallow: /` for Docker builds.
- [ ] **TRACKING CHECK:** I confirmed Google Analytics / AdSense are disabled (NoOp) in this mode.

## Type of change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update

## Checklist:

- [ ] My code follows the style guidelines of this project (FSD/VSA)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] New and existing unit tests pass locally with my changes
