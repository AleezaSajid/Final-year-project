p = r"c:\Users\ALIZA SAJID\OneDrive\Desktop\frontend\src\components\landing\LandingHeroSection.jsx"
text = open(p, encoding="utf-8").read()
text = text.replace(
    '<motion.div className="relative isolate overflow-hidden',
    '<div className="relative isolate overflow-hidden',
    1,
)
text = text.replace(
    '<motion.div className="pointer-events-none absolute inset-0 overflow-hidden"',
    '<motion.div className="pointer-events-none absolute inset-0 overflow-hidden"',
    1,
)
# decorative wrapper should be div
text = text.replace(
    '<motion.div className="pointer-events-none absolute inset-0 overflow-hidden"',
    '<motion.div className="pointer-events-none absolute inset-0 overflow-hidden"',
    1,
)
open(p, "w", encoding="utf-8").write(text)
print("done")
