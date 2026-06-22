const crypto = require('crypto');
const Participant = require('../models/Participant');
const { sendRegistrationEmail, sendTeamRegistrationEmail } = require('../utils/email');

// POST /api/payments/verify
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, participant_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !participant_id) {
      return res.status(400).json({ success: false, message: 'Missing required payment fields.' });
    }

    // GAP 2 FIX: Fetch participant and cross-check the stored order ID
    // This prevents anyone from marking an arbitrary participant as paid
    // even if they somehow had a valid Razorpay signature
    const participant = await Participant.findById(participant_id);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }
    if (participant.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID mismatch. Payment verification failed.',
      });
    }
    // Don't re-verify an already completed payment
    if (participant.paymentStatus === 'verified') {
      return res.status(200).json({ success: true, message: 'Payment already verified.' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      const updatedParticipant = await Participant.findByIdAndUpdate(
        participant_id,
        {
          paymentStatus: 'verified',
          razorpayPaymentId: razorpay_payment_id,
        },
        { new: true }
      );

      if (updatedParticipant) {
        console.log(`✅ Payment verified for: ${updatedParticipant.fullName} (${updatedParticipant.email})`);

        // If they are part of a team, mark all teammates as verified too
        if (updatedParticipant.teamId) {
          await Participant.updateMany(
            { teamId: updatedParticipant.teamId },
            { paymentStatus: 'verified', razorpayPaymentId: razorpay_payment_id }
          );
        }

        try {
          if (updatedParticipant.registrationType === 'individual') {
            await sendRegistrationEmail(updatedParticipant);
          } else if (updatedParticipant.registrationType === 'team') {
            await sendTeamRegistrationEmail(updatedParticipant, updatedParticipant.teamMembers, updatedParticipant.teamName);
          }
        } catch (emailErr) {
          console.error('⚠️ Payment verified but failed to send registration email:', emailErr.message);
        }
      }

      res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (err) {
    console.error('❌ Error verifying Razorpay payment:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payments/status/:participantId
const getPaymentStatus = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.participantId)
      .select('fullName email paymentStatus amount registrationType teamName');
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found.' });
    }
    res.json({ success: true, participant });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { verifyRazorpayPayment, getPaymentStatus };
