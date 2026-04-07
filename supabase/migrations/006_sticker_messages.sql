CREATE TABLE IF NOT EXISTS sticker_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_ar text NOT NULL,
  message_en text NOT NULL,
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sticker_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON sticker_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "anon read stickers" ON sticker_messages FOR SELECT USING (true);

INSERT INTO sticker_messages (message_ar, message_en) VALUES
('القهوة ما تحلى إلا معك ☕', 'Coffee is only sweet with you'),
('يومك حلو مثل قهوتك 🌟', 'Your day is as sweet as your coffee'),
('أنت سبب ابتسامة أحد اليوم 😊', 'You are someone''s reason to smile today'),
('الحياة قصيرة... اطلب كوب ثاني! 🤭', 'Life is short... order a second cup!'),
('ما في مشكلة ما تحلّها قهوة ☕✨', 'No problem coffee can''t fix'),
('كوبك هذا صنعناه بحب 💛', 'This cup was made with love'),
('ديكاف؟ ما نسوّي نهايات حزينة 😂', 'Decaf? We don''t do sad endings'),
('أحلى شي بيومي إنك مريت علينا 🥰', 'Best part of my day — you showed up'),
('القهوة الزينة للناس الزينة ☕❤️', 'Great coffee for great people'),
('الله يسعدك مثل ما سعدنا بزيارتك 🙏', 'May you be as happy as we are to see you'),
('كوب قهوة + يوم حلو = أنت الحين 😎', 'Coffee + good day = you right now'),
('هالكوب فيه طاقة إيجابية مضاعفة ⚡', 'This cup has double positive energy'),
('اللي يشرب قهوتنا ما يرجع لغيرنا 😏', 'Once you try us, there''s no going back'),
('انشر السعادة... وخذ صاحبك كوب 🎁', 'Spread joy — grab a cup for a friend'),
('وراء كل شخص ناجح... كمية قهوة كبيرة ☕💪', 'Behind every success is a LOT of coffee'),
('ابتسم! أنت تشرب أحلى قهوة بالحي 😁', 'Smile! You''re drinking the best coffee around'),
('إذا الدنيا ضاقت... وسّعها بكوب ☕🌈', 'When life gets tight, loosen it with a cup'),
('صباحك قهوة وسعادة ☀️☕', 'Your morning: coffee and happiness'),
('القهوة لغة ما يفهمها إلا الذوّاقة 🎩', 'Coffee — a language only connoisseurs speak'),
('هالكوب مخصوص لك... بالاسم 😉', 'This cup is specially for you... by name'),
('الجمال يبدأ من أول رشفة 💫', 'Beauty starts with the first sip'),
('ما تكتمل السعادة إلا بقهوة شين ☕✨', 'Happiness isn''t complete without SHEEN coffee'),
('كل كوب عندنا قصة... وقصتك أحلاهم 📖', 'Every cup has a story — yours is the best'),
('أنت + قهوة = كومبو خرافي 🔥', 'You + coffee = legendary combo'),
('نصيحة اليوم: لا تحرم نفسك من شي يسعدك ☕❤️', 'Today''s advice: don''t deprive yourself of joy'),
('هذي مو بس قهوة... هذي تجربة ✨', 'This isn''t just coffee... it''s an experience'),
('شكراً إنك اخترتنا 🙌', 'Thank you for choosing us'),
('الضحكة مجانية... القهوة علينا بالأسعار 😂', 'The smile is free... coffee at our prices'),
('يا رب يكون يومك أحلى من قهوتك 🤲', 'May your day be sweeter than your coffee'),
('القهوة حق... والحق يُقال ☕⚖️', 'Coffee is a right — and rights must be served'),
('تبي تنجح؟ ابدأ بكوب قهوة ☕🚀', 'Want to succeed? Start with a cup of coffee'),
('لا تنسى تصوّر كوبك وتتاقنا @SheenCafe 📸', 'Don''t forget to snap your cup and tag @SheenCafe'),
('جيب صاحبك بكرة... أول كوب له علينا! 🎉', 'Bring a friend tomorrow — first cup is on us!'),
('قهوتك اليوم سر نجاحك بكرة ☕🏆', 'Today''s coffee is tomorrow''s success secret'),
('الحياة أحلى بكوب... والكوب أحلى عندنا 💛', 'Life is better with a cup — and cups are better here');
