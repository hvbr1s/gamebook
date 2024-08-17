use anchor_lang::prelude::*;

declare_id!("8cWkPsxTsdQvpFd7vrrpjpMCTPn3J9KripnEDhwJqXHW");

#[program]
pub mod gamebook {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
