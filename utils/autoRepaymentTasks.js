const Info = require('../models/Info');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const SystemSetting = require('../models/SystemSetting');

// Helper function to schedule automatic repayments
const scheduleAutoRepayments = async () => {
    console.log('Running scheduleAutoRepayments...');
    const now = new Date();
    // Define the time window for scheduling (e.g., next 8 hours)
    const schedulingWindowEnd = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours from now

    try {
        const infosToSchedule = await Info.find({
            purchasers: { $exists: true, $not: { $size: 0 } }, // Purchased
            isPaid: false, // Not yet paid
            expiryTime: { $exists: true, $gte: now, $lte: schedulingWindowEnd }, // Has expiryTime and is within the next 8 hours
            isAutoRepaymentScheduled: false, // Not yet scheduled
            period: { $gt: 0 } // Ensure it's a loan type info
        });

        console.log(`Found ${infosToSchedule.length} infos to schedule .`);

        for (const info of infosToSchedule) {
            // Calculate the start and end of the random time window (between now and expiryTime)
            const randomTimeWindowStart = now.getTime();
            const randomTimeWindowEnd = info.expiryTime.getTime();

            // Generate a random time within the window
            const randomRepaymentTime = new Date(randomTimeWindowStart + Math.random() * (randomTimeWindowEnd - randomTimeWindowStart));

            info.isAutoRepaymentScheduled = true;
            info.autoRepaymentTime = randomRepaymentTime;
            await info.save();
        }

    } catch (error) {
        console.error('Error scheduling auto-repayments:', error);
    }
};

// Helper function to execute scheduled automatic repayments
const executeAutoRepayments = async () => {
     const now = new Date();

     try {
         // Find infos for auto-repayment:
         // 1. Scheduled and due
         // 2. OR Expired, not paid, and not currently scheduled (to catch missed ones)
         const infosToRepay = await Info.find({
             $or: [
                 { // Case 1: Scheduled and due
                     isAutoRepaymentScheduled: true,
                     autoRepaymentTime: { $lte: now }
                 },
                 { // Case 2: Expired, not paid, and not scheduled (missed ones)
                     expiryTime: { $lte: now },
                     isAutoRepaymentScheduled: false // Ensure we don't double-process if it somehow got scheduled but expiryTime condition also met
                 }
             ],
             isPaid: false, // Common condition: must not be paid
             purchasers: { $exists: true, $not: { $size: 0 } }, // Common condition: must be purchased
             period: { $gt: 0 } // Common condition: ensure it's a loan type info
         }).populate('purchasers', '_id').populate('author', '_id'); // Populate buyer and author


          for (const info of infosToRepay) {

              // Perform the repayment logic (similar to manual repayment)
              try {
                   const buyerId = info.purchasers[0]?._id; // Assuming single buyer for simplicity
                   const authorId = info.author?._id;
                   const repaymentAmount = Number(info.repaymentAmount); // Ensure amount is number

                   if (!buyerId || !authorId || repaymentAmount <= 0) {
                       console.error(`Auto-repayment skipped for info ${info._id}: Missing buyer/author or invalid amount.`);
                       info.isAutoRepaymentScheduled = false; // Mark as processed (failed)
                       await info.save();
                       continue; // Skip to next info
                   }

                   const [buyer, author] = await Promise.all([
                       User.findById(buyerId).select('balance referrer'),
                       User.findById(authorId).select('balance')
                   ]);

                   if (!buyer || !author) {
                       console.error(`Auto-repayment skipped for info ${info._id}: Buyer or Author user not found.`);
                        info.isAutoRepaymentScheduled = false; // Mark as processed (failed)
                       await info.save();
                       continue; // Skip to next info
                   }

                   // Deduct from author's balance
                   // ** Handle insufficient author balance scenario: maybe set info.isPublic = true; send notification to admin/author **
                   if (author.balance < repaymentAmount) {
                        // Optional: Mark info as public or take other actions
                        // info.isPublic = true;
                        info.isAutoRepaymentScheduled = false; // Reset schedule status
                        await info.save();
                        continue; // Skip to next info
                   }
                   author.balance -= repaymentAmount;
                   await author.save();
                   console.log(`Deducted ${repaymentAmount} from author ${authorId}. New balance: ${author.balance}`);

                   // 计算推荐人返利（如有）
                   let rebateAmount = 0;
                   let referrer = null;
                   if (buyer.referrer) {
                       // 获取返利设置
                       const rebateSettings = await SystemSetting.findOne({ key: 'rebate_settings' });
                       if (rebateSettings) {
                           const { inviteRebatePercentage, minRebateAmount } = rebateSettings.value;
                           
                           // 计算返利金额 - 使用loanAmount（购买价格）而不是repaymentAmount（还款金额）
                           const calculatedRebateAmount = (Number(info.loanAmount) * inviteRebatePercentage / 100);
                           
                           // 检查是否达到最低返利金额
                           if (calculatedRebateAmount >= minRebateAmount) {
                               referrer = await User.findById(buyer.referrer);
                               if (referrer) {
                                   rebateAmount = Math.floor(calculatedRebateAmount);
                                   if (rebateAmount > 0) {
                                       const referrerBalanceBefore = referrer.balance;
                                       referrer.balance += rebateAmount;
                                       await referrer.save();
                                       const referrerBalanceAfter = referrer.balance;
                                       
                                       // 创建推荐人返利交易记录
                                       await Transaction.create({
                                           user: referrer._id,
                                           type: 'REFERRAL_COMMISSION',
                                           amount: rebateAmount,
                                           status: 'approved',
                                           paymentMethod: 'INTERNAL_SETTLEMENT',
                                           paymentAccount: authorId.toString(),
                                           receiveAccount: referrer._id.toString(),
                                           remark: `获得推荐返利，${author.username || '系统'}自动还款`,
                                           infoId: info._id,
                                           createdAt: new Date(),
                                           balanceBefore: referrerBalanceBefore,
                                           balanceAfter: referrerBalanceAfter
                                       });
                                       
                                       console.log(`Auto-repayment: Referrer ${referrer.username} received rebate ${rebateAmount}, balance from ${referrerBalanceBefore} to ${referrerBalanceAfter}`);
                                   }
                               }
                           } else {
                               console.log(`Auto-repayment: Rebate amount ${calculatedRebateAmount} below minimum ${minRebateAmount}, skipping rebate for info ${info._id}`);
                           }
                       } else {
                           console.log(`Auto-repayment: No rebate settings found, skipping rebate for info ${info._id}`);
                       }
                   }

                   // 计算买家实际收款金额（还款金额-返利）
                   const buyerReceiveAmount = repaymentAmount - rebateAmount;
                   
                   // Add to buyer's balance (only the amount after rebate deduction)
                   buyer.balance += buyerReceiveAmount;
                   await buyer.save();
                   console.log(`Added ${buyerReceiveAmount} to buyer ${buyerId}. New balance: ${buyer.balance}`);

                    // Create a transaction record for the repayment
                    await Transaction.create({
                        user: buyerId, // Buyer is the one receiving the repayment
                        type: 'repay', // Repayment type
                        amount: buyerReceiveAmount,
                        status: 'approved', // Auto-repayment is considered approved
                        paymentMethod: 'balance', // Assuming balance payment
                        paymentAccount: authorId.toString(), // Author's account
                        receiveAccount: buyerId.toString(), // Buyer's account
                        remark: `信息到期自动还款: ${info.title || info._id}`, // Transaction remark
                        infoId: info._id,
                        createdAt: new Date(),
                        balanceBefore: buyer.balance - buyerReceiveAmount,
                        balanceAfter: buyer.balance
                    });
                    console.log(`Created repayment transaction for info ${info._id}`);

                    try {
                        const deletedInfo = await Info.findByIdAndDelete(info._id);
                        if (deletedInfo) {
                            console.log(`Info ${info._id} has been automatically repaid and successfully deleted.`);
                        } else {
                            // Deletion failed or document was not found (already deleted?)
                            // As a fallback, or if an error occurred during deletion attempt that we didn't catch above,
                            // attempt to update its status to 'OFFLINE' to signify it's processed but needs attention.
                            const updateResult = await Info.findByIdAndUpdate(
                                info._id, // This might also fail if the document truly doesn't exist
                                { 
                                    $set: {
                                        isPaid: true, 
                                        isAutoRepaymentScheduled: false, 
                                        status: 'OFFLINE' 
                                    }
                                },
                                { new: true, upsert: false } // upsert:false ensures we don't create it if not found
                            );

                            if (updateResult && updateResult.status === 'OFFLINE') {
                                console.log(`Info ${info._id} (post-delete attempt) successfully updated status to OFFLINE.`);
                            } else {
                                console.error(`Info ${info._id} (post-delete attempt) FAILED to update status to OFFLINE. It might have been deleted by another process or a severe issue occurred. DB response: ${JSON.stringify(updateResult)}`);
                                // Consider more robust alerting here if this state is critical
                            }
                        }
                    } catch (processingError) {
                        console.error(`Error during post-repayment processing (delete/update status) for info ${info._id}:`, processingError);
                        // As a last resort if delete and subsequent status update failed, try to mark it
                        // This is to ensure it doesn't get picked up again if isPaid wasn't set due to the error.
                        // However, the primary error should be investigated.
                        try {
                            await Info.findByIdAndUpdate(info._id, {
                                $set: { 
                                    isPaid: true, // At least mark as paid
                                    isAutoRepaymentScheduled: false, // Stop further scheduling
                                    status: 'ERROR_POST_REPAYMENT' // Special status indicating an issue
                                }
                            });
                            console.warn(`Info ${info._id} marked with ERROR_POST_REPAYMENT due to previous error during post-repayment cleanup.`);
                        } catch (finalError) {
                            console.error(`CRITICAL: Failed even to mark info ${info._id} as ERROR_POST_REPAYMENT:`, finalError);
                        }
                    }

               } catch (repaymentError) {
                   console.error(`Error executing auto-repayment for info ${info._id}:`, repaymentError);
                    info.isAutoRepaymentScheduled = false; // Mark as processed (failed)
                    await info.save();
               }
          }

     } catch (error) {
         console.error('Error executing auto-repayments:', error);
     }
};

module.exports = {
    scheduleAutoRepayments,
    executeAutoRepayments
}; 
