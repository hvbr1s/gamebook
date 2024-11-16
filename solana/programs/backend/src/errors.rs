use anchor_lang::prelude::*;

#[error_code]
pub enum ChapterError {
    #[msg("Too many chapters already, this story is over!")]
    TooManyChapters,
}