DROP TABLE IF EXISTS flashcards CASCADE;
DROP TABLE IF EXISTS flashcard_decks CASCADE;

CREATE TABLE flashcard_decks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES "User"(id),
    title VARCHAR NOT NULL,
    description TEXT,
    document_id VARCHAR,
    course_code VARCHAR,
    card_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX ix_flashcard_decks_user_id ON flashcard_decks(user_id);

CREATE TABLE flashcards (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    deck_id TEXT NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    next_review TIMESTAMP WITH TIME ZONE,
    review_count INTEGER DEFAULT 0,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX ix_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX ix_flashcards_next_review ON flashcards(next_review);

ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcard_decks_user_policy') THEN
        CREATE POLICY flashcard_decks_user_policy ON flashcard_decks
        USING (user_id = current_setting('app.current_user_id', true))
        WITH CHECK (user_id = current_setting('app.current_user_id', true));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcards_user_policy') THEN
        CREATE POLICY flashcards_user_policy ON flashcards
        USING (deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = current_setting('app.current_user_id', true)))
        WITH CHECK (deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = current_setting('app.current_user_id', true)));
    END IF;
END $$;

UPDATE alembic_version SET version_num = '005_add_flashcards';
