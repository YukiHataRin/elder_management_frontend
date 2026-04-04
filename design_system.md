## Design System: Health Task Manager

### Pattern
- **Name:** Trust & Authority + Accessible
- **CTA Placement:** Above fold
- **Sections:** Hero > Features > CTA

### Style
- **Name:** Accessible & Ethical
- **Keywords:** High contrast, large text (16px+), keyboard navigation, screen reader friendly, WCAG compliant, focus state, semantic
- **Best For:** Government, healthcare, education, inclusive products, large audience, legal compliance, public
- **Performance:** ⚡ Excellent | **Accessibility:** ✓ WCAG AAA

### Colors
| Role | Hex |
|------|-----|
| Primary | #0369A1 |
| Secondary | #38BDF8 |
| CTA | #22C55E |
| Background | #F0F9FF |
| Text | #0C4A6E |

*Notes: Calm blue + reassuring green*

### Typography
- **Heading:** Lora
- **Body:** Raleway
- **Mood:** calm, wellness, health, relaxing, natural, organic
- **Best For:** Health apps, wellness, spa, meditation, yoga, organic brands
- **Google Fonts:** https://fonts.google.com/share?selection.family=Lora:wght@400;500;600;700|Raleway:wght@300;400;500;600;700
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Clear focus rings (3-4px), ARIA labels, skip links, responsive design, reduced motion, 44x44px touch targets

### Avoid (Anti-patterns)
- Small text
- Complex navigation
- AI purple/pink gradients

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px

