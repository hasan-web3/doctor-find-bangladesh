import { getDoctorFormPickers } from "@/lib/admin-pickers";
import { DoctorForm } from "../doctor-form";
import { EMPTY_SOCIAL_LINKS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const emptyML = { bn: "", en: "" };

export default async function NewDoctorPage() {
  // Nothing on this page depends on the request, so with the pickers cached a
  // blank doctor form now renders without touching the database at all.
  const pickers = await getDoctorFormPickers();

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">নতুন ডাক্তার যুক্ত করুন</h1>
      <DoctorForm
        initial={{
          name: { ...emptyML }, slug: "", degrees: { ...emptyML }, bio: { ...emptyML }, gender: null,
          experience_years: null, patients_served: { ...emptyML }, treated_conditions: { ...emptyML },
          hospital_id: null,
          // A new profile starts on the weaker badge. BMDC verification is a
          // claim about a lookup someone actually performed, so it is never a
          // default — the admin turns it on after checking the register.
          verified: true, active: true,
          bmdc_verified: false, bmdc_no: "", bmdc_reg_year: null, bmdc_valid_till: "",
          meta_title: { ...emptyML }, meta_description: { ...emptyML }, photo_url: null,
          social_links: EMPTY_SOCIAL_LINKS(),
          specialty_ids: [],
          custom_specialties: [],
          chambers: [{
            name: { ...emptyML }, address: { ...emptyML },
            district_id: null, area_id: null, custom_area: { ...emptyML },
            fee: 0, phone: "", map_url: "",
            owner_email: "", bcc_email: "hasan25042019@gmail.com", from_email: "noreply@doctorsfindbd.com",
            // New chambers start hidden — admin explicitly toggles on to publish.
            visible: false, lat: null, lng: null,
            schedule: [],
          }],
        }}
        specialties={pickers.specialties}
        areas={pickers.areas}
        hospitals={pickers.hospitals}
        districts={pickers.districts}
      />
    </div>
  );
}
