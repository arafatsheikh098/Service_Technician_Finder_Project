-- Reference data every environment needs (production included): the service catalog.
-- Idempotent, so it is safe on databases that were already seeded.
INSERT INTO service_categories (slug, name, name_bn, description, base_price_bdt) VALUES
  ('electrician', 'Electrician', 'ইলেকট্রিশিয়ান', 'Wiring, switches, sockets, fans, lights, breakers', 500),
  ('plumber', 'Plumber', 'প্লাম্বার', 'Leaks, taps, pipes, drains, toilets, water pumps', 500),
  ('ac-repair', 'AC Repair & Servicing', 'এসি সার্ভিসিং', 'AC servicing, gas refill, installation, not cooling', 1200),
  ('appliance-repair', 'Appliance Repair', 'হোম অ্যাপ্লায়েন্স মেরামত', 'Fridge, washing machine, microwave, oven', 800),
  ('carpenter', 'Carpenter', 'কাঠমিস্ত্রি', 'Doors, locks, furniture repair and assembly', 600),
  ('painter', 'Painter', 'রং মিস্ত্রি', 'Interior and exterior painting, damp walls', 1500),
  ('cleaning', 'Home Cleaning', 'পরিষ্কার-পরিচ্ছন্নতা', 'Deep cleaning, sofa and carpet cleaning', 1000),
  ('pest-control', 'Pest Control', 'পেস্ট কন্ট্রোল', 'Cockroaches, termites, bed bugs, rodents', 1500),
  ('computer-repair', 'Computer Repair', 'কম্পিউটার মেরামত', 'Laptop and desktop repair, OS install, virus removal', 700),
  ('cctv-installation', 'CCTV Installation', 'সিসিটিভি ইনস্টলেশন', 'Security camera installation and setup', 1500)
ON CONFLICT (slug) DO NOTHING;
