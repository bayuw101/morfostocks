import { NetPressureProV2Board } from "@/components/analysis/technical/net-pressure-pro-v2-board";

export const metadata = {
    title: "Net Pressure | Morfostocks",
    description: "Realtime Net Pressure with Whale vs Retail Session Pressure.",
};

export default function NetPressurePage() {
    return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#121b2d]">
            <NetPressureProV2Board />
        </div>
    );
}
