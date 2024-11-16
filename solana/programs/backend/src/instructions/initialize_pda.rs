use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::ChapterError;

pub fn initialize_pda(ctx: Context<Initialize>, chapter_count: u8) -> Result<()> {
    let account_data = &mut ctx.accounts.pda_account;
    require!(
        chapter_count <= 200,
        ChapterError::TooManyChapters
    );
    account_data.user = *ctx.accounts.user.key;
    account_data.chapter =  chapter_count; 
    account_data.bump = ctx.bumps.pda_account;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// CHECK: Ok
    pub user: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        seeds = [b"gamebook_toly", user.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + Chapter::INIT_SPACE
    )]
    pub pda_account: Account<'info, Chapter>,
    pub system_program: Program<'info, System>,
}
