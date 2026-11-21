import {publicReport} from '@/lib/editorial';
import PredictionsView from './PredictionsView';
export const dynamic = 'force-dynamic';
export const metadata = {title:'BAZARSPORT · Predictions / Прогнози'};
export default async function PredictionsPage(){
 let report: Awaited<ReturnType<typeof publicReport>> | null = null;
 try {report = await publicReport();} catch {}
 return <PredictionsView report={report}/>;
}
