import { useEffect, useState, type FormEvent } from "react";

import {
  getProfile,
  updateProfile,
  changePassword,
  getImageUrl,
  type Profile as ProfileData,
} from "../../api/profile";

import MediaSelector from "../../components/Media/MediaSelector";

import type { MediaItem } from "../../api/media";

const Profile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [name, setName] = useState("");

  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const [imagePreview, setImagePreview] = useState("");

  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const loadProfile = async () => {
    setLoading(true);

    setError("");

    try {
      const response = await getProfile();

      setProfile(response);

      setName(response.name);

      setImagePreview(getImageUrl(response.profile_image));

      if (response.media_id && response.profile_image) {
        setSelectedMedia({
          _id: response.media_id,

          file_name: response.profile_image.split("/").pop() || "profile-image",

          original_name:
            response.profile_image.split("/").pop() || "profile-image",

          title: "Profile Image",

          alt_text: "Profile Image",

          description: "",

          mime_type: "image",

          file_type: "image",

          extension: "",

          file_size: 0,

          url: response.profile_image,

          is_deleted: false,
        });
      }
    } catch (error: any) {
      console.log("PROFILE ERROR:", error);

      console.log("PROFILE RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleMediaSelect = (media: MediaItem) => {
    setSelectedMedia(media);

    setImagePreview(getImageUrl(media.url));

    setIsMediaSelectorOpen(false);

    setError("");
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    setSuccess("");

    if (!name.trim()) {
      setError("Name is required");

      return;
    }

    setSaving(true);

    try {
      const response = await updateProfile(name.trim(), selectedMedia?._id);

      setSuccess(response.message || "Profile updated successfully");

      setProfile((previous) =>
        previous
          ? {
              ...previous,

              name: name.trim(),

              profile_image: response.profile_image,

              media_id: response.media_id,
            }
          : previous,
      );

      setImagePreview(getImageUrl(response.profile_image));
    } catch (error: any) {
      console.log("UPDATE PROFILE ERROR:", error);

      console.log("UPDATE PROFILE RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    setSuccess("");

    if (!currentPassword) {
      setError("Current password is required");

      return;
    }

    if (!newPassword) {
      setError("New password is required");

      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");

      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match");

      return;
    }

    setChangingPassword(true);

    try {
      const response = await changePassword(currentPassword, newPassword);

      setSuccess(response.message || "Password changed successfully");

      setCurrentPassword("");

      setNewPassword("");

      setConfirmPassword("");
    } catch (error: any) {
      console.log("CHANGE PASSWORD ERROR:", error);

      console.log("CHANGE PASSWORD RESPONSE:", error.response?.data);

      setError(error.response?.data?.detail || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="page-heading">
          <div>
            <h1>Profile</h1>

            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <h1>Profile</h1>

          <p>Update your profile information</p>
        </div>
      </div>

      {error && <div className="profile-message-error">{error}</div>}

      {success && <div className="profile-message-success">{success}</div>}

      <div className="profile-grid">
        <div className="profile-card">
          <h2>Profile Information</h2>

          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <div className="profile-image-section">
              <div className="profile-image-wrapper">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="profile-image"
                  />
                ) : (
                  <div className="profile-image-placeholder">
                    {name ? name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="profile-image-button"
                onClick={() => setIsMediaSelectorOpen(true)}
              >
                Choose Image
              </button>

              <span className="profile-image-help">
                Select from Media Library or upload from computer
              </span>

              {selectedMedia && (
                <span className="profile-image-selected">
                  Selected:{" "}
                  {selectedMedia.original_name || selectedMedia.file_name}
                </span>
              )}
            </div>

            <div className="profile-form-group">
              <label>Name</label>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="profile-form-group">
              <label>Email</label>

              <input type="email" value={profile?.email || ""} disabled />
            </div>

            <div className="profile-form-group">
              <label>Role</label>

              <input type="text" value={profile?.role || ""} disabled />
            </div>

            <div className="profile-form-group">
              <label>Status</label>

              <input
                type="text"
                value={profile?.is_active ? "Active" : "Inactive"}
                disabled
              />
            </div>

            <button type="submit" disabled={saving}>
              {saving ? "Updating..." : "Update Profile"}
            </button>
          </form>
        </div>

        <div className="profile-card">
          <h2>Change Password</h2>

          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <div className="profile-form-group">
              <label>Current Password</label>

              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="profile-form-group">
              <label>New Password</label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>

            <div className="profile-form-group">
              <label>Confirm New Password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <button type="submit" disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>

      <MediaSelector
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={handleMediaSelect}
        selectedMediaId={selectedMedia?._id}
      />
    </div>
  );
};

export default Profile;
