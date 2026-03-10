import { redirect } from "next/navigation";

export const metadata = {
    title: "Net Pressure | Morfostocks",
    description: "Moved to /analysis/net-pressure",
};

export default function NetPressureProV2Page() {
    redirect("/analysis/net-pressure");
}
