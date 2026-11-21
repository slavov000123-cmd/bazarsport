import {publicReport} from '@/lib/editorial';
import PredictionsView from '../predictions/PredictionsView';
export const dynamic = 'force-dynamic';
export const metadata = {title:'BAZARSPORT · Statistics / Статистика'};
export default async function Page(){
 let report: Awaited<ReturnType<typeof publicReport>> | null = null;
 try {report = await publicReport();} catch {}
 return <PredictionsView report={report} view='statistics'/>;
}
