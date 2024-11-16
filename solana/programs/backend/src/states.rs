use anchor_lang::prelude::*;

pub const STORY_LENGTH: usize = 255;

#[account]
#[derive(InitSpace)]
pub struct Chapter {
    pub user: Pubkey,
    pub bump: u8,
    pub chapter: u8,
}