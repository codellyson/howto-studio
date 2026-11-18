# python3 -I lines.py <script.md>: prints "<line id>\t<voiceover>" for each row of the script table.
import sys


def read(path):
    rows = []
    for row in open(path):
        if row.startswith('| L'):
            cells = [c.strip() for c in row.strip().strip('|').split('|')]
            rows.append((cells[0], cells[-1]))
    return rows


if __name__ == '__main__':
    for line_id, text in read(sys.argv[1]):
        print(line_id, text, sep='\t')
