export default function Page() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-8">
      <h1 className="font-display text-[26px] font-semibold text-ink">Templates</h1>
      <p className="mt-1 text-sm text-muted">Reusable templates</p>
      <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
        <p className="text-[17px] font-medium text-ink">You have no templates</p>
        <p className="mt-1 text-sm text-muted">Create reusable templates to send envelopes faster.</p>
        <button className="btn-secondary mt-4">Create new</button>
      </div>
    </div>
  );
}
