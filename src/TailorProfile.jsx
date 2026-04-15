import React, { useEffect, useState } from "react";
import DashboardNavbar from "./components/DashboardNavbar";
import { PageBackground } from "./components/PageBackground.jsx";

const TAILOR_PROFILE_STORAGE_KEY = "sewserve_tailor_profiles";
const tailorId = "T-A1";
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#FFF7ED"/>
    <circle cx="60" cy="44" r="22" fill="#FDBA74"/>
    <path d="M22 108c4-20 18-32 38-32s34 12 38 32" fill="#FDBA74"/>
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
};

const getProfileImageSrc = (picture) => (picture ? picture : DEFAULT_AVATAR);
const gradientCardClass =
  "rounded-2xl border border-orange-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md";
const smallGradientCardClass = `${gradientCardClass} rounded-xl p-4`;

export default function TailorProfile() {
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
    const profile = profiles[tailorId] || defaultProfile;
    setFormValues({
      name: profile.name || "",
      skills: profile.skills || "",
      experience: String(profile.experience || "").replace(" years", ""),
      contact: profile.contact || "",
      email: profile.email || "",
      profilePicture: profile.profilePicture || "",
    });
  }, [profiles]);

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
    if (!formValues.skills.trim()) nextErrors.skills = "Specialty/Skills is required.";
    if (!formValues.experience.trim()) nextErrors.experience = "Experience is required.";
    else if (!/^\d+$/.test(formValues.experience.trim())) nextErrors.experience = "Experience must be numeric.";
    if (!formValues.contact.trim()) nextErrors.contact = "Contact number is required.";
    if (!formValues.email.trim()) nextErrors.email = "Email is required.";
    else if (!emailRegex.test(formValues.email.trim())) nextErrors.email = "Enter a valid email address.";
    return nextErrors;
  };

  const handleSave = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const updatedProfiles = {
      ...profiles,
      [tailorId]: {
        ...(profiles[tailorId] || {}),
        name: formValues.name.trim(),
        skills: formValues.skills.trim(),
        experience: `${Number(formValues.experience)} years`,
        contact: formValues.contact.trim(),
        email: formValues.email.trim(),
        profilePicture: formValues.profilePicture || "",
      },
    };

    setProfiles(updatedProfiles);
    localStorage.setItem(TAILOR_PROFILE_STORAGE_KEY, JSON.stringify(updatedProfiles));
    setSuccessMessage("Profile updated successfully.");
    window.setTimeout(() => setSuccessMessage(""), 2200);
  };

  return (
    <div className="relative isolate min-h-screen bg-transparent text-[#6B7280] antialiased">
      <PageBackground />
      <DashboardNavbar />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className={`${gradientCardClass} p-6`}>
          <h1 className="text-2xl font-bold text-[#111827]">Tailor Profile</h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            View and update your personal information and profile photo.
          </p>

          <form onSubmit={handleSave} className="mt-6 grid gap-6 lg:grid-cols-[240px,1fr]">
            <div className={smallGradientCardClass}>
              <div className="mx-auto h-40 w-40 overflow-hidden rounded-full border border-orange-200 bg-orange-50">
                <img src={getProfileImageSrc(formValues.profilePicture)} alt="Tailor profile preview" className="h-full w-full object-cover" />
              </div>
              <label
                htmlFor="profile-picture"
                className="mt-4 inline-flex w-full cursor-pointer justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                Upload Picture
              </label>
              <input id="profile-picture" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <div className={`${gradientCardClass} p-4 sm:p-6`}>
              <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#111827]" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  value={formValues.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
                />
                {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111827]" htmlFor="skills">
                  Specialty / Skills
                </label>
                <input
                  id="skills"
                  name="skills"
                  value={formValues.skills}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
                />
                {errors.skills ? <p className="mt-1 text-xs text-red-600">{errors.skills}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#111827]" htmlFor="experience">
                    Experience (Years)
                  </label>
                  <input
                    id="experience"
                    name="experience"
                    value={formValues.experience}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
                  />
                  {errors.experience ? <p className="mt-1 text-xs text-red-600">{errors.experience}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#111827]" htmlFor="contact">
                    Contact Number
                  </label>
                  <input
                    id="contact"
                    name="contact"
                    value={formValues.contact}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
                  />
                  {errors.contact ? <p className="mt-1 text-xs text-red-600">{errors.contact}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#111827]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  value={formValues.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-500 transition"
                />
                {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-orange-600 py-2 px-4 text-sm font-semibold text-white transition duration-200 hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                Save Profile
              </button>
              {successMessage ? (
                <p className={`${smallGradientCardClass} py-3 text-sm text-[#111827]`}>
                  {successMessage}
                </p>
              ) : null}
            </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
