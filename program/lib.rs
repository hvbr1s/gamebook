use anchor_lang::prelude::*;

declare_id!("EwjMrKendd6q8tVPXpZWhXWm6ftwca6GWjuRykRBk9N8");

#[program]
pub mod pda_account {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account_data = &mut ctx.accounts.pda_account;
        // store the address of the `user`
        account_data.user = *ctx.accounts.user.key;
        // store the canonical bump
        account_data.bump = ctx.bumps.pda_account;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// CHECK: Ok
    pub user: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        // set the seeds to derive the PDA
        seeds = [b"gamebook", user.key().as_ref()],
        // use the canonical bump
        bump,
        payer = payer,
        space = 8 + DataAccount::INIT_SPACE
    )]
    pub pda_account: Account<'info, DataAccount>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct DataAccount {
    pub user: Pubkey,
    pub bump: u8,
}
