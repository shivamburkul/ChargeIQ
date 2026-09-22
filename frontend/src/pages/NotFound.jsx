
import { Link } from 'react-router-dom';
import BoltMark from '../components/BoltMark';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <BoltMark className="w-14 h-14 mb-4 opacity-60" />
      <h1 className="font-display text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-500 mb-6">This route doesn't exist — like a charging station with no cable.</p>
      <Link to="/" className="btn-primary">Back to home</Link>
    </div>
  );
}


