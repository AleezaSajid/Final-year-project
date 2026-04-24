import React, { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import DashboardNavbar from "./components/DashboardNavbar";
import { PageBackground } from "./components/PageBackground.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { resolveTailorIdWhenViewingAsTailor } from "./utils/chatIdentity.js";

const TAILOR_PROFILE_STORAGE_KEY = "sewserve_tailor_profiles";
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#f1f5f9"/>
    <circle cx="60" cy="44" r="22" fill="#94a3b8"/>
    <path d="M22 108c4-20 18-32 38-32s34 12 38 32" fill="#94a3b8"/>
  </svg>`
)}`;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const defaultProfile = {
  name: "",
  skills: "",
  experience: "",
  contact: "",
  email: "",
  profilePicture: "",
  aboutMe: "",
};

const getProfileImageSrc = (picture) => (picture ? picture : DEFAULT_AVATAR);

export default function TailorProfile() {
  const { user } = useAuth();
  const activeTailorId = useMemo(() => resolveTailorIdWhenViewingAsTailor(user), [user]);

  const [profiles, setProfiles] = useState(() => {
    try {
      const saved = localStorage.getItem(TAILOR_PROFILE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [formValues, setFormValues] = useState(defaultProfile);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const profile = profiles[activeTailorId] || defaultProfile;
    setFormValues({
      name: profile.name || "",
      skills: profile.skills || "",
      experience: String(profile.experience || "").replace(" years", ""),
      contact: profile.contact || "",
      email: profile.email || "",
      profilePicture: profile.profilePicture || "",
      aboutMe: profile.aboutMe || "",
    });
  }, [profiles, activeTailorId]);

  useEffect(() => {
    document.title = "SewServe | Profile";
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormValues((prev) => ({ ...prev, profilePicture: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors = {};
    if (!formValues.name.trim()) nextErrors.name = "Name is required.";
    if (!formValues.skills.trim()) nextErrors.skills = "Specialty / skills is required.";
    if (!formValues.experience.trim()) nextErrors.experience = "Experience is required.";
    else if (!/^\d+$/.test(formValues.experience.trim())) nextErrors.experience = "Enter years as a number.";
    if (!formValues.contact.trim()) nextErrors.contact = "Contact number is required.";
    if (!formValues.email.trim()) nextErrors.email = "Email is required.";
    else if (!emailRegex.test(formValues.email.trim())) nextErrors.email = "Enter a valid email.";
    return nextErrors;
  };

  const handleSave = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const updatedProfiles = {
      ...profiles,
      [activeTailorId]: {
        ...(profiles[activeTailorId] || {}),
        name: formValues.name.trim(),
        skills: formValues.skills.trim(),
        experience: `${Number(formValues.experience)} years`,
        contact: formValues.contact.trim(),
        email: formValues.email.trim(),
        profilePicture: formValues.profilePicture || "",
        aboutMe: formValues.aboutMe.trim(),
      },
    };

    setProfiles(updatedProfiles);
    localStorage.setItem(TAILOR_PROFILE_STORAGE_KEY, JSON.stringify(updatedProfiles));
    setSuccessMessage("Profile saved.");
    window.setTimeout(() => setSuccessMessage(""), 2500);
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-700/30 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent font-['Inter',system-ui,sans-serif] text-slate-600 antialiased">
      <PageBackground />
      <DashboardNavbar />

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-800/10 text-emerald-800">
              <UserRound className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your profile</h1>
              <p className="mt-1 text-sm text-slate-500">Update how you appear to customers. Changes are saved on this device.</p>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8"
          style={{ boxShadow: "0 4px 24px -8px rgba(15, 23, 42, 0.08)" }}
        >
          <div className="flex flex-col items-center gap-6 border-b border-slate-100 pb-8 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <div className="h-32 w-32 overflow-hidden rounded-2xl ring-1 ring-slate-200 sm:h-36 sm:w-36">
                <img src={getProfileImageSrc(formValues.profilePicture)} alt="" className="h-full w-full object-cover" />
              </div>
              <label
                htmlFor="tp-photo"
                className="mt-3 flex cursor-pointer justify-center text-sm font-medium text-emerald-800 hover:text-emerald-900"
              >
                Change photo
              </label>
              <input id="tp-photo" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="name">
                  Name
                </label>
                <input id="name" name="name" value={formValues.name} onChange={handleChange} className={inputClass} />
                {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="skills">
                  Specialties (comma-separated)
                </label>
                <input
                  id="skills"
                  name="skills"
                  value={formValues.skills}
                  onChange={handleChange}
                  placeholder="e.g. Suits, alterations, bridal"
                  className={inputClass}
                />
                {errors.skills ? <p className="mt-1 text-xs text-red-600">{errors.skills}</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="aboutMe">
                About you
              </label>
              <textarea
                id="aboutMe"
                name="aboutMe"
                rows={4}
                value={formValues.aboutMe}
                onChange={handleChange}
                placeholder="A short bio for customers…"
                className={`${inputClass} resize-y`}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="experience">
                  Years of experience
                </label>
                <input
                  id="experience"
                  name="experience"
                  inputMode="numeric"
                  value={formValues.experience}
                  onChange={handleChange}
                  className={inputClass}
                />
                {errors.experience ? <p className="mt-1 text-xs text-red-600">{errors.experience}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="contact">
                  Phone
                </label>
                <input id="contact" name="contact" value={formValues.contact} onChange={handleChange} className={inputClass} />
                {errors.contact ? <p className="mt-1 text-xs text-red-600">{errors.contact}</p> : null}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" value={formValues.email} onChange={handleChange} className={inputClass} />
              {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-b from-[#3d6b4a] to-[#2f5a42] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2"
            >
              Save profile
            </button>
            {successMessage ? (
              <p className="text-sm font-medium text-emerald-800" role="status">
                {successMessage}
              </p>
            ) : null}
          </div>
        </form>
      </main>
    </div>
  );
}
