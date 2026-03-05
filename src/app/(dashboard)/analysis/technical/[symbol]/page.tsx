
import { Metadata } from "next";
import TechnicalDetailPageClient from "./client";

type Props = {
    params: Promise<{ symbol: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const decodedSymbol = decodeURIComponent(symbol);

    return {
        title: `${decodedSymbol} Analysis - Morfostocks`,
        description: `Technical analysis, charts, and broker summary for ${decodedSymbol}`,
    };
}

export default async function TechnicalDetailPage({ params }: Props) {
    return <TechnicalDetailPageClient params={params} />;
}
