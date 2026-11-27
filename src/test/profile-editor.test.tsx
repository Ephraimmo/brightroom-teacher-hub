import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileEditor } from "@/components/account/profile-editor";
import type { MyProfile } from "@/lib/profile-service";

const service = vi.hoisted(() => ({
  loadMyProfile: vi.fn(),
  saveMyProfile: vi.fn(),
  replaceMyAvatar: vi.fn(),
  removeMyAvatar: vi.fn(),
  avatarLink: vi.fn(),
}));
vi.mock("@/lib/profile-service", () => service);

const amy: MyProfile = {
  fullName: "Amy Learner",
  displayName: "Amy",
  phone: "+27821234567",
  language: "en",
  contactEmail: true,
  contactSms: false,
  contactWhatsapp: false,
  avatarPath: null,
  extended: true,
};

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ProfileEditor userId="amy" />
    </QueryClientProvider>,
  );
}

const field = (label: RegExp) => screen.getByLabelText(label);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("My profile", () => {
  it("shows the saved details, with the number written the local way", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    renderEditor();
    expect(await screen.findByDisplayValue("Amy Learner")).toBeInTheDocument();
    expect(field(/Mobile number/)).toHaveValue("082 123 4567");
    expect(field(/Preferred language/)).toHaveValue("en");
    expect(screen.getByRole("checkbox", { name: "Email" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "WhatsApp" })).not.toBeChecked();
  });

  it("saves the changes", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    service.saveMyProfile.mockResolvedValue(true);
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    type(field(/Preferred language/), "xh");
    fireEvent.click(screen.getByRole("checkbox", { name: "WhatsApp" }));
    save();
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(service.saveMyProfile).toHaveBeenCalledWith(
      "amy",
      expect.objectContaining({ language: "xh", contactWhatsapp: true }),
      true,
    );
  });

  it("explains a bad number next to the field and doesn't save", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    type(field(/Mobile number/), "011 123 4567");
    save();
    expect(await screen.findByText(/Enter a South African mobile number/)).toBeInTheDocument();
    expect(field(/Mobile number/)).toHaveAttribute("aria-invalid", "true");
    expect(service.saveMyProfile).not.toHaveBeenCalled();
  });

  it("won't turn on WhatsApp without a number", async () => {
    service.loadMyProfile.mockResolvedValue({ ...amy, phone: "" });
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    fireEvent.click(screen.getByRole("checkbox", { name: "WhatsApp" }));
    save();
    expect(await screen.findByText(/Add your mobile number/)).toBeInTheDocument();
    expect(service.saveMyProfile).not.toHaveBeenCalled();
  });

  it("shows a database refusal on the right field", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    service.saveMyProfile.mockRejectedValue({ code: "LBR13" });
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    save();
    expect(await screen.findByText("Choose a language from the list.")).toBeInTheDocument();
  });

  it("rejects an unsuitable photo before uploading", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    const gif = new File(["x"], "cat.gif", { type: "image/gif" });
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [gif] } });
    expect(await screen.findByText("Choose a JPG, PNG or WebP picture.")).toBeInTheDocument();
    expect(service.replaceMyAvatar).not.toHaveBeenCalled();
  });

  it("uploads a photo", async () => {
    service.loadMyProfile.mockResolvedValue(amy);
    service.replaceMyAvatar.mockResolvedValue("amy/1.webp");
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    const photo = new File(["x"], "me.webp", { type: "image/webp" });
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [photo] } });
    await waitFor(() => expect(service.replaceMyAvatar).toHaveBeenCalledWith("amy", photo, null));
  });

  it("before the database update, offers only name fields and says why", async () => {
    service.loadMyProfile.mockResolvedValue({ ...amy, phone: "", extended: false });
    service.saveMyProfile.mockResolvedValue(true);
    renderEditor();
    await screen.findByDisplayValue("Amy Learner");
    expect(screen.queryByLabelText(/Mobile number/)).not.toBeInTheDocument();
    expect(screen.queryByText("Profile photo")).not.toBeInTheDocument();
    expect(screen.getByText(/once the latest database update is applied/)).toBeInTheDocument();
    save();
    await waitFor(() =>
      expect(service.saveMyProfile).toHaveBeenCalledWith("amy", expect.anything(), false),
    );
  });

  it("offers a retry when the profile can't load", async () => {
    service.loadMyProfile.mockRejectedValue(new Error("down"));
    renderEditor();
    expect(await screen.findByText("Your profile could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
