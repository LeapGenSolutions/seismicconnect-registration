import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { CURRENT_BAA_VERSION } from "../constants/baaAgreement";

const TermsDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1E3A8A]">
            Seismic, by LeapGen.
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <DialogDescription className="text-base font-semibold text-gray-700">
              Network Business Associate Agreement
            </DialogDescription>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {CURRENT_BAA_VERSION}
            </span>
          </div>
          <DialogDescription className="text-sm text-gray-600 italic">
            (HIPAA-Compliant | AI-Enabled Healthcare Support Platform)
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1  space-y-6 text-sm text-gray-700 leading-relaxed terms-content">
          {/* Parties */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">Parties</h3>
            <p className="leading-relaxed">
              This Business Associate Agreement ("BAA") governs the relationship between<span className="font-bold"> Seismic by Leapgen, Inc., </span> 
              a Virginia-based company ("Business Associate"), and the applicable healthcare provider ("Covered Entity"). 
              The BAA applies only to the extent Seismic creates, receives, maintains, or transmits Protected Health 
              Information ("PHI") on behalf of the Covered Entity in connection with Seismic's services.
            </p>
          </section>

          {/* Purpose & Regulatory Framework */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Purpose & Regulatory Framework
            </h3>
            <p className="leading-relaxed">
              This Agreement is intended to satisfy the requirements of the <span className="font-bold">Health Insurance Portability and 
              Accountability Act of 1996 (HIPAA)</span> and its implementing regulations. It ensures the lawful handling, 
              protection, and limited use of PHI while enabling Seismic to support healthcare operations under the 
              parties' services agreement.
            </p>
          </section>

          {/* Role of AI and Human Decision-Making */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Role of AI and Human Decision-Making (Key Principle)
            </h3>
            <p className="leading-relaxed mb-3">
              Seismic provides <span className="font-bold">AI-enabled informational and analytical tools</span> to support healthcare professionals.
            </p>
            <p className="leading-relaxed font-semibold ">Importantly:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Seismic's technology <span className="font-bold">does not replace, override, or make clinical decisions</span>.</li>
              <li>All medical judgments, diagnoses, treatment decisions, and patient care determinations <span className="font-bold">remain 
                  solely the responsibility of licensed healthcare professionals</span>.</li>
              <li>Seismic's outputs are intended to <span className="font-bold">augment human expertise</span>, not substitute for professional judgment 
                  or clinical discretion. Seismic is a platform as a service and your use of it is under your best judgment.</li>
            </ul>
          </section>

          {/* Business Associate Obligations */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Business Associate Obligations
            </h3>
            <p className="leading-relaxed ">Seismic agrees to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Use and disclose PHI <span className="font-bold">only as permitted</span> by the BAA, the services agreement, or as required by law.</li>
              <li>Implement <span className="font-bold">administrative, technical, and physical safeguards</span> consistent with HIPAA Security Rule requirements.</li>
              <li>Report any <span className="font-bold">breach of unsecured PHI</span> or known security incidents as required by HIPAA.</li>
              <li>Ensure that any subcontractors handling PHI are bound by <span className="font-bold">HIPAA-compliant written agreements</span>.</li>
              <li>Support Covered Entity obligations related to:
                <ul className="sub-points-list list-none space-y-1 ml-6 mt-1">
                  <li>Individual access to records</li>
                  <li>Amendments</li>
                  <li>Accounting of disclosures</li>
                </ul>
              </li>
              <li>Make relevant records available to the U.S. Department of Health and Human Services upon request 
                  for compliance purposes.</li>
            </ul>
          </section>

          {/* Permitted Uses of PHI */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Permitted Uses of PHI
            </h3>
            <p className="leading-relaxed ">Seismic may use PHI only to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Perform services for the Covered Entity</li>
              <li>Support its internal management and legal obligations (as permitted by HIPAA)</li>
              <li><span className="font-bold">De-identify PHI</span> in accordance with HIPAA standards, after which such data is no longer considered PHI</li>
              <li>Provide data aggregation services related to healthcare operations, where permitted</li>
            </ul>
            <p className="leading-relaxed mt-3 italic">
              All uses are subject to the <span className="font-bold">minimum necessary standard</span>.
            </p>
          </section>

          {/* Covered Entity Responsibilities */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Covered Entity Responsibilities
            </h3>
            <p className="leading-relaxed ">The Covered Entity agrees to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Obtain all required patient authorizations and consents</li>
              <li>Notify Seismic of any changes to privacy practices, restrictions, or revocations affecting PHI</li>
              <li>Refrain from requesting any use or disclosure of PHI that would violate HIPAA</li>
            </ul>
          </section>

          {/* Term, Termination & Post-Termination Duties */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Term, Termination & Post-Termination Duties
            </h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>The BAA remains in effect for the duration of the services relationship.</li>
              <li>Either party may terminate for material breach if not cured within 30 days.</li>
              <li>Upon termination, Seismic will:
                <ul className="sub-points-list list-none space-y-1 ml-6 mt-1">
                  <li>Return or destroy PHI where feasible</li>
                  <li>Retain only PHI necessary for legal or administrative obligations</li>
                  <li>Continue safeguarding any retained PHI until properly disposed of</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* Confidentiality & Non-Disclosure */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Confidentiality & Non-Disclosure (NDA)
            </h3>
            <p className="leading-relaxed ">
              Each party agrees that, during and after the term of this Agreement:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
              <span className="font-bold">Confidential Information,</span> including but not limited to:
                <ul className="sub-points-list list-none space-y-1 ml-6 mt-1">
                  <li>Business plans</li>
                  <li>Product roadmaps</li>
                  <li>Technical architectures</li>
                  <li>Algorithms, models, and trade secrets</li>
                  <li>Pricing, contracts, and strategic information</li>
                </ul>
                shall be kept strictly confidential.
              </li>
              <li>Confidential Information <span className="font-bold">may not be disclosed, used, or exploited</span> for any purpose outside the 
                  scope of the services relationship.</li>
              <li>No party may use the other's Confidential Information for competitive purposes or reverse engineering.</li>
              <li>These obligations <span className="font-bold">survive termination</span> of the Agreement.</li>
            </ul>
          </section>

          {/* Legal & Miscellaneous */}
          <section>
            <h3 className="text-lg font-semibold text-[#1E40AF] ">
              Legal & Miscellaneous
            </h3>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><span className="font-bold">Governing Law:</span> Virginia (to the extent not preempted by federal law)</li>
              <li><span className="font-bold">Dispute Resolution:</span> Binding arbitration under JAMS rules</li>
              <li>No third-party beneficiaries</li>
              <li>If conflicts arise, this BAA<span className="font-bold"> controls over other agreements</span> with respect to PHI</li>
              <li>Invalid provisions do not affect the remainder of the Agreement</li>
            </ul>
          </section>
        </div>
      </DialogContent>
      
      {/* Custom scrollbar and sub-points styling */}
      <style>{`
        .terms-content::-webkit-scrollbar {
          width: 8px;
        }
        .terms-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .terms-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .terms-content::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .sub-points-list li {
          position: relative;
          padding-left: 1rem;
        }
        .sub-points-list li::before {
          content: "•";
          position: absolute;
          left: 0;
          color: #9ca3af;
          font-size: 1rem;
        }
      `}</style>
    </Dialog>
  );
};

export default TermsDialog;
