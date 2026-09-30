import docx

doc = docx.Document(r'c:\digital_document_system-main\การพัฒนาระบบจัดการเอกสารดิจิทัลพร้อมการลงนามอัจฉริยะะ 123.docx')
lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

with open('headings.txt', 'w', encoding='utf-8') as f:
    for line in lines:
        if 'บท' in line or 'บทที่' in line:
            f.write(line + '\n')
        # Also just print some context if we see chapter 4 or 5
        if '4' in line or '5' in line:
            # f.write("Potential Ch4/5: " + line + '\n')
            pass
